import sharp from "sharp";
import { env } from "../../config/env.js";
import type { ImageInput, ProcessingContext } from "../../types/image.js";
import { detector, type WatermarkDetection } from "./providers/detectionProvider.js";

/**
 * Finds likely watermarks. The image is turned upright first (as the browser shows it), so the regions
 * line up with what the user sees. Returns regions only — the image itself is never touched here.
 */
export async function detectWatermark(input: ImageInput, { signal }: ProcessingContext) {
    const upright = await sharp(input.buffer, { limitInputPixels: env.maxImagePixels }).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 95 }).toBuffer();
    const found = await detector.detect(upright, signal);
    const detections: WatermarkDetection[] = found.map((detection, index) => ({ ...detection, id: `d${index + 1}` }));
    return { width: input.width, height: input.height, detections, detector: detector.name };
}
