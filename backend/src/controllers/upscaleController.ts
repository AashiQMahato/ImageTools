import type { RequestHandler } from "express";
import { upscaleImage } from "../services/upscaling/upscaleService.js";
import type { UpscaleOptions } from "../types/image.js";
import { toImageInput } from "../utils/image.js";

function parseScale(value: unknown): UpscaleOptions["scale"] {
    return value === "4" ? 4 : 2;
}

export const upscaleHandler: RequestHandler = async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    // Errors (including NotImplementedError → 501) propagate to the error handler.
    const result = await upscaleImage(toImageInput(req.file), { scale: parseScale(body?.scale) });
    res.type(result.mimeType).send(result.buffer);
};
