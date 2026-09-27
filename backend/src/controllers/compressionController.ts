import type { RequestHandler } from "express";
import { compression, type CompressionOptions, QUALITY_PRESETS, type QualityPreset } from "../services/compression/compressionService.js";
import { validateImage } from "../services/image-processing/imageValidation.service.js";
import { AppError } from "../utils/AppError.js";
import { processingContext, safeBaseName, sendImage } from "../utils/http.js";

const FORMATS = ["auto", "jpeg", "png", "webp"] as const;
const invalid = (message: string) => new AppError(message, 400, "INVALID_REQUEST");

function optionalNumber(value: unknown, min: number, max: number, name: string): number | undefined {
    if (value === undefined || value === "") return undefined;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) throw invalid(`${name} is out of range.`);
    return number;
}

const flag = (value: unknown, fallback: boolean) => (value === undefined || value === "" ? fallback : value === "true" || value === "1" || value === "on");

function parseOptions(body: Record<string, unknown>): CompressionOptions {
    const preset = (body.qualityPreset ?? "balanced") as QualityPreset;
    if (!Object.hasOwn(QUALITY_PRESETS, preset)) throw invalid("Choose a compression level.");
    const format = (body.outputFormat ?? "auto") as (typeof FORMATS)[number];
    if (!FORMATS.includes(format)) throw invalid("Choose JPG, PNG, WebP or Auto.");
    const unit = body.targetUnit === "MB" ? 1024 * 1024 : 1024;
    const target = optionalNumber(body.targetSize, 1, 100_000, "Target size");
    const quality = optionalNumber(body.quality, 1, 100, "Quality");
    return {
        preset,
        quality: quality === undefined ? undefined : Math.round(quality),
        format,
        targetBytes: target === undefined ? undefined : Math.round(target * unit),
        maxWidth: optionalNumber(body.maxWidth, 16, 20_000, "Width"),
        maxHeight: optionalNumber(body.maxHeight, 16, 20_000, "Height"),
        stripMetadata: flag(body.stripMetadata, true),
        progressive: flag(body.progressive, true),
    };
}

/** The compressed image itself, with what happened in headers (sizes, format, whether the target was met). */
export const compressHandler: RequestHandler = async (req, res) => {
    const options = parseOptions((req.body ?? {}) as Record<string, unknown>);
    const input = await validateImage(req.file);
    const result = await compression.compress(input, req.file!.size, options, processingContext(req, res));
    res.set({
        "X-Original-Size": String(req.file!.size),
        "X-Compressed-Size": String(result.buffer.length),
        "X-Output-Format": result.format,
        "X-Quality": String(result.quality),
        "X-Resized": String(result.resized),
        "X-Flattened": String(result.flattened),
        "X-Already-Optimal": String(result.alreadyOptimal),
        ...(result.targetMet === undefined ? {} : { "X-Target-Met": String(result.targetMet) }),
    });
    sendImage(res, { buffer: result.buffer, mimeType: result.mimeType, extension: result.extension, width: result.width, height: result.height }, `${safeBaseName(input.originalName)}-compressed.${result.extension}`, input);
};
