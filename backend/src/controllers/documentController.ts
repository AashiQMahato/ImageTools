import { createReadStream } from "node:fs";
import type { Request, RequestHandler, Response } from "express";
import { Zip, ZipPassThrough } from "fflate";
import type { DocumentUpload } from "../middleware/documentUpload.js";
import { removeWorkspace } from "../services/files/workspace.js";
import { deleteJob, describeJob, type JobContext, jobFile, jobFiles, startJob } from "../services/jobs/jobService.js";
import { type ImagesToPdfOptions, imagesToPdf } from "../services/pdf/imagesToPdfService.js";
import { mergePdfs, organizePdf, parsePlan, splitPdf } from "../services/pdf/organizeService.js";
import { pdfToImages } from "../services/pdf/renderService.js";
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
