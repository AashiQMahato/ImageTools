import type { RequestHandler } from "express";
import { validateImage } from "../services/image-processing/imageValidation.service.js";
import { upscaling } from "../services/upscaling/upscaleService.js";
import type { UpscaleScale } from "../types/image.js";
import { AppError } from "../utils/AppError.js";
import { processingContext, safeBaseName, sendImage } from "../utils/http.js";

const SCALES: readonly UpscaleScale[] = [2, 4];

function parseScale(value: unknown): UpscaleScale {
    const scale = Number(value ?? 2);
    if (!SCALES.includes(scale as UpscaleScale)) throw new AppError("Scale must be 2 or 4.", 400, "INVALID_SCALE");
    return scale as UpscaleScale;
}

export const upscaleHandler: RequestHandler = async (req, res) => {
    const scale = parseScale((req.body as Record<string, unknown> | undefined)?.scale);
    const input = await validateImage(req.file);
    const output = await upscaling.upscale(input, { scale }, processingContext(req, res));
    sendImage(res, output, `${safeBaseName(input.originalName)}-upscaled-${scale}x.${output.extension}`, input);
};
