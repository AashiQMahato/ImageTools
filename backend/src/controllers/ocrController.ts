import type { RequestHandler } from "express";
import { ocr } from "../services/ocr/ocrService.js";
import type { Region } from "../services/ocr/preprocessingService.js";
import type { OcrLanguage } from "../services/ocr/types.js";
import { AppError } from "../utils/AppError.js";
import { processingContext } from "../utils/http.js";

const LANGUAGES: readonly OcrLanguage[] = ["auto", "en", "ne", "mixed"];
const invalidRegion = () => new AppError("That selection isn't valid. Please select the area again.", 400, "INVALID_REGION");

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** `region`: JSON — {"type":"rect","box":{x,y,width,height}} or {"type":"polygon","points":[[x,y],…]}, in image pixels. */
function parseRegion(value: unknown): Region | null {
    if (value === undefined || value === "") return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(String(value));
    } catch {
        throw invalidRegion();
    }
    const region = parsed as { type?: string; box?: Record<string, unknown>; points?: unknown };
    if (region.type === "rect" && region.box && [region.box.x, region.box.y, region.box.width, region.box.height].every(finite)) {
        return { type: "rect", box: region.box as { x: number; y: number; width: number; height: number } };
    }
    if (region.type === "polygon" && Array.isArray(region.points) && region.points.length >= 3 && region.points.length <= 2000 && region.points.every((point) => Array.isArray(point) && point.length === 2 && point.every(finite))) {
        return { type: "polygon", points: region.points as [number, number][] };
    }
    throw invalidRegion();
}

/**
 * Streams progress as newline-delimited JSON — one event per line, the document (or an error) last —
 * so the page can show each step as it happens. The recognised text is never logged.
 */
export const ocrHandler: RequestHandler = async (req, res) => {
    const file = req.file;
    if (!file || file.size === 0) throw new AppError("Please choose an image to upload.", 400, "FILE_REQUIRED");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const language = (body.language ?? "auto") as OcrLanguage;
    if (!LANGUAGES.includes(language)) throw new AppError("Choose a language.", 400, "INVALID_REQUEST");
    const region = parseRegion(body.region);
    const preserveLayout = body.preserveLayout !== "false";
    const context = processingContext(req, res);

    res.status(200).set({ "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    const send = (event: object) => {
        if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };
    try {
        const document = await ocr.extract({ upload: file.buffer, language, region, preserveLayout }, send, context);
        send({ type: "result", data: { success: true, ...document } });
    } catch (error) {
        if (context.signal.aborted) return void res.end();
        if (!(error instanceof AppError)) console.error(error);
        const safe = error instanceof AppError ? error : new AppError("We couldn't read the text in this image. Please try again.", 500, "PROCESSING_FAILED");
        send({ type: "error", code: safe.code, message: safe.message });
    }
    res.end();
};
