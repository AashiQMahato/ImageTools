import sharp, { type Sharp } from "sharp";
import type { ProcessingContext } from "../../types/image.js";
import { AppError } from "../../utils/AppError.js";
import { upscaling } from "../upscaling/upscaleService.js";

/** Does the crop hold enough pixels for the output? `factor` is how much it would have to grow. */
export function checkResolution(cropHeight: number, targetHeight: number) {
    const factor = targetHeight / Math.max(1, cropHeight);
    return { sufficient: factor <= 1, factor };
}

export type UpscaleMethod = "ai" | "resample";

/**
 * Doubles an image's resolution. The AI upscaler (Upscayl) adds real detail; when it isn't available on
 * this server, a high-quality Lanczos resample stands in — and the result says which one ran.
 */
export async function upscaleImage(jpeg: Buffer, size: { width: number; height: number }, context: ProcessingContext): Promise<{ buffer: Buffer; width: number; height: number; method: UpscaleMethod }> {
    if (upscaling.isAvailable()) {
        try {
            const output = await upscaling.upscale({ buffer: jpeg, originalName: "photo.jpg", format: "jpeg", width: size.width, height: size.height, hasAlpha: false }, { scale: 2 }, context);
            return { buffer: output.buffer, width: output.width, height: output.height, method: "ai" };
        } catch (error) {
            if (error instanceof AppError && error.code === "REQUEST_CANCELLED") throw error;
            console.warn("AI upscaling failed; resampling instead.");
        }
    }
    const width = size.width * 2;
    const height = size.height * 2;
    const buffer = await sharp(jpeg).resize(width, height, { fit: "fill", kernel: "lanczos3" }).jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
    return { buffer, width, height, method: "resample" };
}

/**
 * Resizes to exact pixel dimensions. The source must already have the target's aspect ratio — this
 * refuses to stretch (anything beyond rounding is a bug upstream, not something to paper over).
 */
export function resizeImage(image: Sharp, source: { width: number; height: number }, target: { width: number; height: number }): Sharp {
    const distortion = Math.abs(source.width / source.height / (target.width / target.height) - 1);
    if (distortion > 0.01) throw new AppError("The crop doesn't match the photo's shape. Please adjust it and try again.", 422, "INVALID_CROP");
    return image.resize(target.width, target.height, { fit: "fill", kernel: "lanczos3" });
}

/**
 * Writes the print resolution into the file (JFIF density for JPEG, pHYs for PNG). This only labels the
 * pixels — the pixel dimensions were already made right for this DPI by `resizeImage`.
 */
export async function setDpi(image: Sharp, dpi: number, format: "jpeg" | "png"): Promise<Buffer> {
    const labelled = image.withMetadata({ density: dpi });
    return format === "jpeg" ? labelled.jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true }).toBuffer() : labelled.png({ compressionLevel: 9 }).toBuffer();
}
