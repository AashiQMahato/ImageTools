import { createReadStream } from "node:fs";
import type { Request, RequestHandler, Response } from "express";
import { Zip, ZipPassThrough } from "fflate";
import type { DocumentUpload } from "../middleware/documentUpload.js";
import { removeWorkspace } from "../services/files/workspace.js";
import { deleteJob, describeJob, type JobContext, jobFile, jobFiles, startJob } from "../services/jobs/jobService.js";
import { type ImagesToPdfOptions, imagesToPdf } from "../services/pdf/imagesToPdfService.js";
import { mergePdfs, organizePdf, parsePlan, splitPdf } from "../services/pdf/organizeService.js";
import { pdfToImages } from "../services/pdf/renderService.js";
import { type CompressPreset, compressPdf, PRESETS } from "../services/pdf/compressService.js";
import { hexColour } from "../services/pdf/stamp.js";
import { type NumberPosition, numberPages, type Position, watermarkPdf } from "../services/pdf/stampService.js";
import { pdfToText } from "../services/pdf/textService.js";
import { annotatePdf, parseAnnotations } from "../services/pdf/annotateService.js";
import { protectPdf, unlockPdf } from "../services/pdf/protectService.js";
import { pdfToWord } from "../services/pdf/wordService.js";
import { AppError } from "../utils/AppError.js";

const bad = (message: string) => new AppError(message, 400, "INVALID_REQUEST");

function field(req: Request, name: string): string | undefined {
    const value = (req.body as Record<string, unknown> | undefined)?.[name];
    return typeof value === "string" ? value : undefined;
}

function choice<T extends string>(value: string | undefined, choices: readonly T[], fallback: T): T {
    if (value === undefined || value === "") return fallback;
    if (!(choices as readonly string[]).includes(value)) throw bad("One of the options isn't valid.");
    return value as T;
}

function number(value: string | undefined, min: number, max: number, fallback: number): number {
    if (value === undefined || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw bad("One of the options isn't valid.");
    return parsed;
}

/**
 * Starts the work as a job and answers at once (202) with its id. If the options are wrong the upload is
 * deleted immediately, rather than waiting to expire.
 */
function jobHandler(operation: string, prepare: (req: Request, upload: DocumentUpload) => (context: JobContext) => Promise<void>): RequestHandler {
    return async (req, res) => {
        const upload = res.locals.documents as DocumentUpload;
        let work: (context: JobContext) => Promise<void>;
        try {
            work = prepare(req, upload);
        } catch (error) {
            await removeWorkspace(upload.workspace.dir);
            throw error;
        }
        const id = startJob(operation, upload.workspace, work);
        res.status(202).json({ success: true, data: describeJob(id) });
    };
}

export const mergeHandler = jobHandler("merge", (_req, { files }) => {
    if (files.length < 2) throw bad("Choose at least two PDFs to merge.");
    return (context) => mergePdfs(files, context);
});

export const splitHandler = jobHandler("split", (req, { files }) => {
    const mode = choice(field(req, "mode"), ["every", "ranges"] as const, "every");
    const ranges = field(req, "ranges") ?? "";
    if (mode === "ranges" && !ranges.trim()) throw new AppError("Enter the pages, for example 1-3, 5, 7-10.", 400, "INVALID_PAGES");
    return (context) => splitPdf(files[0]!, mode === "every" ? { mode } : { mode, ranges }, context);
});

export const organizeHandler = jobHandler("organize", (req, { files }) => {
    const plan = parsePlan(field(req, "plan"));
    return (context) => organizePdf(files[0]!, plan, context);
});

export const toImagesHandler = jobHandler("to-images", (req, { files }) => {
    const options = {
        format: choice(field(req, "format"), ["jpg", "png", "webp"] as const, "jpg"),
        dpi: number(field(req, "dpi"), 36, 600, 150),
        quality: number(field(req, "quality"), 40, 100, 85),
        pages: field(req, "pages")?.trim() || null,
    };
    return (context) => pdfToImages(files[0]!, options, context);
});

export const fromImagesHandler = jobHandler("from-images", (req, { files }) => {
    const options: ImagesToPdfOptions = {
        size: choice(field(req, "size"), ["a4", "letter", "legal", "original", "custom"] as const, "a4"),
        orientation: choice(field(req, "orientation"), ["auto", "portrait", "landscape"] as const, "auto"),
        custom: { width: number(field(req, "customWidth"), 20, 2000, 210), height: number(field(req, "customHeight"), 20, 2000, 297) },
        margin: number(field(req, "margin"), 0, 100, 10),
        fit: choice(field(req, "fit"), ["contain", "cover", "original"] as const, "contain"),
        quality: number(field(req, "quality"), 40, 100, 85),
        maxDpi: field(req, "maxDpi") === "none" ? null : number(field(req, "maxDpi"), 72, 600, 300),
    };
    let rotations: unknown = [];
    try {
        rotations = JSON.parse(field(req, "rotations") ?? "[]");
    } catch {
        throw bad("One of the options isn't valid.");
    }
    if (!Array.isArray(rotations) || rotations.some((turn) => ![0, 90, 180, 270].includes(turn))) throw bad("One of the options isn't valid.");
    const inputs = files.map((file, index) => ({ ...file, rotate: ((rotations as number[])[index] ?? 0) as 0 | 90 | 180 | 270 }));
    return (context) => imagesToPdf(inputs, options, context);
});

export const compressHandler = jobHandler("compress", (req, { files }) => {
    const preset = choice(field(req, "preset"), ["maximum", "recommended", "high", "custom"] as const, "recommended") as CompressPreset;
    const settings = preset === "custom" ? { quality: number(field(req, "quality"), 20, 100, 70), maxSide: number(field(req, "maxSide"), 512, 6000, 1800) } : PRESETS[preset];
    return (context) => compressPdf(files[0]!, { quality: Math.round(settings.quality), maxSide: Math.round(settings.maxSide) }, context);
});

/** Short text: no control characters, not empty, not too long. */
function label(value: string | undefined, max: number, missing: string) {
    const text = [...(value ?? "")].map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? " " : char)).join("").trim();
    if (!text) throw bad(missing);
    if (text.length > max) throw bad(`Please keep it under ${max} characters.`);
    return text;
}

const POSITIONS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const;

export const watermarkHandler = jobHandler("watermark", (req, { files, image }) => {
    const kind = choice(field(req, "kind"), ["text", "image"] as const, "text");
    const options = {
        kind,
        text: kind === "text" ? label(field(req, "text"), 120, "Type the watermark text.") : "",
        fontSize: number(field(req, "fontSize"), 6, 300, 48),
        color: hexColour(field(req, "color") ?? "#c0392b"),
        opacity: number(field(req, "opacity"), 0.05, 1, 0.3),
        rotation: number(field(req, "rotation"), -180, 180, -45),
        position: choice(field(req, "position"), [...POSITIONS, "tile"] as const, "center") as Position | "tile",
        imageScale: number(field(req, "imageScale"), 0.05, 1, 0.4),
        pages: field(req, "pages")?.trim() || null,
    };
    if (kind === "image" && !image) throw new AppError("Choose an image for the watermark.", 400, "FILE_REQUIRED");
    return (context) => watermarkPdf(files[0]!, options, kind === "image" ? image : null, context);
});

export const pageNumbersHandler = jobHandler("page-numbers", (req, { files }) => {
    const template = label(field(req, "template"), 40, "Choose how the numbers read.");
    if (!template.includes("{n}")) throw bad("The format needs the page number.");
    const options = {
        position: choice(field(req, "position"), ["top-left", "top", "top-right", "bottom-left", "bottom", "bottom-right"] as const, "bottom") as NumberPosition,
        template,
        fontSize: number(field(req, "fontSize"), 6, 48, 11),
        margin: number(field(req, "margin"), 12, 144, 30),
        start: Math.round(number(field(req, "start"), 0, 100_000, 1)),
        color: hexColour(field(req, "color") ?? "#1a1a1a"),
        pages: field(req, "pages")?.trim() || null,
    };
    return (context) => numberPages(files[0]!, options, context);
});

export const toTextHandler = jobHandler("to-text", (req, { files }) => {
    const options = {
        mode: choice(field(req, "mode"), ["auto", "text", "ocr"] as const, "auto"),
        language: choice(field(req, "language"), ["auto", "en", "ne", "mixed"] as const, "auto"),
    };
    return (context) => pdfToText(files[0]!, options, context);
});

/** A password as typed: 1–256 characters, nothing else checked (any characters are allowed). */
function password(value: string | undefined, required: boolean) {
    const text = value ?? "";
    if (required && !text) throw bad("Enter a password.");
    if (text.length > 256) throw bad("That password is too long.");
    return text;
}

export const protectHandler = jobHandler("protect", (req, { files }) => {
    const options = {
        password: password(field(req, "password"), true),
        ownerPassword: field(req, "ownerPassword") ? password(field(req, "ownerPassword"), true) : null,
        allowPrint: field(req, "allowPrint") === "true",
        allowCopy: field(req, "allowCopy") === "true",
        allowEdit: field(req, "allowEdit") === "true",
    };
    return (context) => protectPdf(files[0]!, options, context);
});

export const unlockHandler = jobHandler("unlock", (req, { files }) => {
    const secret = password(field(req, "password"), false);
    return (context) => unlockPdf(files[0]!, secret, context);
});

export const annotateHandler = jobHandler("annotate", (req, { files, images }) => {
    const annotations = parseAnnotations(field(req, "annotations"));
    let deletePages: unknown = [];
    try {
        deletePages = JSON.parse(field(req, "deletePages") ?? "[]");
    } catch {
        throw bad("One of the options isn't valid.");
    }
    if (!Array.isArray(deletePages) || !deletePages.every((page) => Number.isInteger(page) && page > 0)) throw bad("One of the options isn't valid.");
    // Images are matched to annotations by the key they were uploaded under (their file name, minus the extension).
    const pictures = new Map(images.map((image) => [image.name.replace(/\.[^.]*$/, ""), image.path]));
    const purpose = field(req, "purpose") === "sign" ? "sign" : "edit";
    return (context) => annotatePdf(files[0]!, annotations, deletePages as number[], pictures, context, purpose);
});

export const toWordHandler = jobHandler("to-word", (req, { files }) => {
    const language = choice(field(req, "language"), ["auto", "en", "ne", "mixed"] as const, "auto");
    return (context) => pdfToWord(files[0]!, { language }, context);
});

// ------------------------------------------------------------------ jobs

const jobId = (req: Request) => {
    const id = String(req.params.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("This result has expired or doesn't exist. Please run the tool again.", 404, "JOB_EXPIRED");
    return id;
};

export const getJobHandler: RequestHandler = (req, res) => {
    res.set("Cache-Control", "no-store").json({ success: true, data: describeJob(jobId(req)) });
};

export const deleteJobHandler: RequestHandler = async (req, res) => {
    await deleteJob(jobId(req));
    res.status(204).end();
};

/** RFC 6266: an ASCII fallback plus the UTF-8 name. */
function disposition(name: string, inline: boolean) {
    const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export const jobFileHandler: RequestHandler = (req, res: Response) => {
    const file = jobFile(jobId(req), String(req.params.fileId ?? ""));
    res.status(200).set({
        "Content-Type": file.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": disposition(file.name, req.query.inline === "1"),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    });
    createReadStream(file.path).on("error", () => res.destroy()).pipe(res);
};

/** Every result file in one ZIP, streamed as it's built (nothing extra held in memory or on disk). */
export const jobArchiveHandler: RequestHandler = (req, res) => {
    const files = jobFiles(jobId(req));
    const job = describeJob(jobId(req));
    res.status(200).set({
        "Content-Type": "application/zip",
        "Content-Disposition": disposition(`${job.operation === "to-images" ? "pages" : "documents"}.zip`, false),
        "Cache-Control": "no-store",
    });
    const zip = new Zip((error, chunk, final) => {
        if (error) return res.destroy();
        res.write(chunk);
        if (final) res.end();
    });
    const used = new Set<string>();
    const next = (index: number) => {
        const file = files[index];
        if (!file) return zip.end();
        let name = file.name;
        for (let copy = 2; used.has(name); copy++) name = file.name.replace(/(\.[^.]*)?$/, `-${copy}$1`);
        used.add(name);
        // Images and PDFs are already compressed: stored as they are.
        const entry = new ZipPassThrough(name);
        zip.add(entry);
        const stream = createReadStream(file.path);
        stream.on("data", (chunk) => entry.push(new Uint8Array(chunk as Buffer)));
        stream.on("end", () => {
            entry.push(new Uint8Array(0), true);
            next(index + 1);
        });
        stream.on("error", () => res.destroy());
    };
    next(0);
};
