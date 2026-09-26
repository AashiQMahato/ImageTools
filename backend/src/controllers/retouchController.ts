import type { RequestHandler } from "express";
import { validateImage } from "../services/image-processing/imageValidation.service.js";
import { RETOUCH_MODES, retouching } from "../services/retouch/retouchService.js";
import type { RetouchMode } from "../types/image.js";
import { AppError } from "../utils/AppError.js";
import { processingContext, safeBaseName, sendImage } from "../utils/http.js";

function parseMode(value: unknown): RetouchMode {
    if (!RETOUCH_MODES.includes(value as RetouchMode)) throw new AppError("Choose a retouch mode.", 400, "INVALID_MODE");
    return value as RetouchMode;
}

/** A 0–1 setting; anything missing or malformed falls back to the default rather than failing. */
function parseFraction(value: unknown, fallback: number): number {
    const number = Number(value);
    return value === undefined || value === "" || !Number.isFinite(number) ? fallback : Math.min(1, Math.max(0, number));
}

export const retouchHandler: RequestHandler = async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const mode = parseMode(body.mode);
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const input = await validateImage(files.file?.[0]);
    const mask = files.mask?.[0];
    if (!mask || mask.size === 0) throw new AppError("Select an area to retouch first.", 400, "EMPTY_MASK");

    const options = { mode, strength: parseFraction(body.strength, 0.5), texture: parseFraction(body.texture, 0.6) };
    const output = await retouching.retouch(input, mask.buffer, options, processingContext(req, res));
    sendImage(res, output, `${safeBaseName(input.originalName)}-retouched.${output.extension}`, input);
};
