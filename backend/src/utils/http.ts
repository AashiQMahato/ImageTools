import type { Request, Response } from "express";
import type { ImageOutput, ProcessingContext } from "../types/image.js";

/** A context whose signal aborts if the client goes away before we respond, so work stops instead of running on. */
export function processingContext(req: Request, res: Response): ProcessingContext {
    const controller = new AbortController();
    res.on("close", () => {
        if (!res.writableFinished) controller.abort();
    });
    req.on("aborted", () => controller.abort());
    return { signal: controller.signal };
}

/** "Holiday Photo (1).JPG" → "holiday-photo-1". Never trust or echo user file names verbatim in headers. */
export function safeBaseName(originalName: string, fallback = "image"): string {
    const base = originalName.replace(/\.[^.]*$/, "");
    const slug = base
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase()
        .slice(0, 60);
    return slug || fallback;
}

/**
 * "नेपाली फाइल (1).pdf" → "नेपाली-फाइल-1": for document results, whose names are sent UTF-8 encoded.
 * Letters and digits of any script stay; separators, control and path characters don't.
 */
export function safeDocumentName(originalName: string, fallback = "document"): string {
    const base = originalName.normalize("NFC").replace(/\.[^.]*$/, "");
    const clean = base
        .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, " ")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
    return clean || fallback;
}

export function sendImage(res: Response, output: ImageOutput, fileName: string, original: { width: number; height: number }) {
    res.status(200)
        .set({
            "Content-Type": output.mimeType,
            "Content-Length": String(output.buffer.length),
            "Content-Disposition": `inline; filename="${fileName}"`,
            "Cache-Control": "no-store",
            "X-Image-Width": String(output.width),
            "X-Image-Height": String(output.height),
            "X-Original-Width": String(original.width),
            "X-Original-Height": String(original.height),
        })
        .end(output.buffer);
}
