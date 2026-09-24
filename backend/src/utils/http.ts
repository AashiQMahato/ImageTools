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
export function safeBaseName(originalName: string): string {
    const base = originalName.replace(/\.[^.]*$/, "");
    const slug = base
        .normalize("NFKD")
        .replace(/[^\w\s-]/g, "")
        .trim()
        .replace(/[\s_]+/g, "-")
        .replace(/-+/g, "-")
        .toLowerCase()
        .slice(0, 60);
    return slug || "image";
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
