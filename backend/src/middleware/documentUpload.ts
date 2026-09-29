import path from "node:path";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { createWorkspace, removeWorkspace, type Workspace } from "../services/files/workspace.js";
import { hasPdfSignature, invalidPdf } from "../services/pdf/pdfDocument.js";
import { AppError } from "../utils/AppError.js";

type Kind = "pdf" | "image";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif", ".tif", ".tiff", ".bmp", ".gif"];

const accepts = (kind: Kind, file: Express.Multer.File) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (kind === "pdf") return extension === ".pdf" && ["application/pdf", "application/octet-stream", "application/x-pdf", ""].includes(file.mimetype);
    return IMAGE_EXTENSIONS.includes(extension) && (file.mimetype.startsWith("image/") || file.mimetype === "application/octet-stream" || file.mimetype === "");
};

function uploadError(kind: Kind, error: unknown): AppError {
    if (error instanceof AppError) return error;
    if (error instanceof multer.MulterError) {
        const limit = kind === "pdf" ? env.documents.maxPdfMb : env.documents.maxImageMb;
        switch (error.code) {
            case "LIMIT_FILE_SIZE":
                return new AppError(`This file is too large. Please use files under ${limit} MB.`, 413, "FILE_TOO_LARGE");
            case "LIMIT_FILE_COUNT":
                return new AppError(`That's more than ${env.documents.maxFiles} files. Please use fewer at a time.`, 413, "TOO_MANY_FILES");
            default:
                return new AppError("The upload couldn't be processed.", 400, "FILE_REQUIRED");
        }
    }
    return new AppError("The upload couldn't be processed.", 400, "FILE_REQUIRED");
}

export interface DocumentUpload {
    workspace: Workspace;
    files: { path: string; name: string }[];
    /** An accompanying image (a watermark), when the tool takes one. */
    image: { path: string; name: string } | null;
}

/**
 * Receives document uploads straight into a new private workspace on disk (large PDFs never sit in
 * memory), under names generated here. Checks the type (PDFs by their signature, not their name),
 * size and count; anything refused is deleted before the error is reported.
 */
export function documentUpload(kind: Kind, { min = 1, max = env.documents.maxFiles, withImage = false } = {}): RequestHandler {
    const maxBytes = Math.round((kind === "pdf" ? env.documents.maxPdfMb : env.documents.maxImageMb) * 1024 * 1024);
    const maxTotal = env.documents.maxTotalMb * 1024 * 1024;
    const tooMuch = () => new AppError(`These files are too large together. Please keep them under ${env.documents.maxTotalMb} MB in total.`, 413, "FILE_TOO_LARGE");
    return async (req: Request, res: Response, next: NextFunction) => {
        // Refused before a byte is written, when the request says how big it is.
        if (Number(req.headers["content-length"] ?? 0) > maxTotal + 1024 * 1024) return next(tooMuch());
        const workspace = await createWorkspace();
        const upload = multer({
            storage: multer.diskStorage({
                destination: workspace.dir,
                filename: (_req, file, callback) => {
                    const extension = kind === "pdf" && file.fieldname !== "image" ? "pdf" : path.extname(file.originalname).toLowerCase().slice(1) || "img";
                    callback(null, path.basename(workspace.file(/^[a-z0-9]{1,5}$/.test(extension) ? extension : "img")));
                },
            }),
            limits: { fileSize: maxBytes, files: max + (withImage ? 1 : 0), fields: 16, fieldSize: 512 * 1024, parts: max + 18 },
            fileFilter: (_req, file, callback) => {
                if (accepts(file.fieldname === "image" ? "image" : kind, file)) callback(null, true);
                else callback(new AppError(kind === "pdf" ? "This file format isn't supported. Please choose a PDF." : "This file format isn't supported. Please use JPG, PNG, WebP or HEIC images.", 415, "UNSUPPORTED_MEDIA_TYPE"));
            },
        }).fields([{ name: "files", maxCount: max }, ...(withImage ? [{ name: "image", maxCount: 1 }] : [])]);

        try {
            await new Promise<void>((resolve, reject) => upload(req, res, (error: unknown) => (error ? reject(error) : resolve())));
            const received = (req.files as Record<string, Express.Multer.File[]> | undefined) ?? {};
            const files = received.files ?? [];
            const extra = received.image?.[0] ?? null;
            if ([...files, ...(extra ? [extra] : [])].reduce((sum, file) => sum + file.size, 0) > maxTotal) throw tooMuch();
            if (files.length < min) {
                throw new AppError(min > 1 ? `Choose at least ${min} files.` : "Please choose a file.", 400, "FILE_REQUIRED");
            }
            if (kind === "pdf") {
                for (const file of files) {
                    if (!(await hasPdfSignature(file.path))) {
                        const error = invalidPdf();
                        throw files.length > 1 ? new AppError(`${file.originalname.slice(0, 80)}: ${error.message}`, error.statusCode, error.code) : error;
                    }
                }
            }
            // Names are only ever used to label results (and are cleaned for that); paths are ours.
            const named = (file: Express.Multer.File) => ({ path: file.path, name: Buffer.from(file.originalname, "latin1").toString("utf8") });
            res.locals.documents = { workspace, files: files.map(named), image: extra ? named(extra) : null } satisfies DocumentUpload;
            next();
        } catch (error) {
            await removeWorkspace(workspace.dir);
            next(uploadError(kind, error));
        }
    };
}
