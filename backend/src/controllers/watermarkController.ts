import type { RequestHandler } from "express";
import { validateImage } from "../services/image-processing/imageValidation.service.js";
import { detectWatermark } from "../services/watermark/detectionService.js";
import { removeWatermark } from "../services/watermark/removalService.js";
import { AppError } from "../utils/AppError.js";
import { processingContext, safeBaseName, sendImage } from "../utils/http.js";

/** Likely watermark regions (never a changed image). */
export const detectWatermarkHandler: RequestHandler = async (req, res) => {
    const input = await validateImage(req.file);
    res.json({ success: true, data: await detectWatermark(input, processingContext(req, res)) });
};

/** The image with the selected area rebuilt. The mask (PNG, opaque where selected) travels separately. */
export const removeWatermarkHandler: RequestHandler = async (req, res) => {
    const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>;
    const input = await validateImage(files.file?.[0]);
    const mask = files.mask?.[0];
    if (!mask || mask.size === 0) throw new AppError("Select the watermark first.", 400, "EMPTY_MASK");
    const { output, warnings } = await removeWatermark({ input, mask: mask.buffer, context: processingContext(req, res) });
    if (warnings.length) res.set("X-Quality-Warning", warnings.join(","));
    sendImage(res, output, `${safeBaseName(input.originalName)}-cleaned.${output.extension}`, input);
};
