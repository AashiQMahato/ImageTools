import sharp, { type Metadata, type Sharp } from "sharp";
import { env } from "../../config/env.js";
import type { ImageInput, ImageOutput, ProcessingContext } from "../../types/image.js";
import { AppError } from "../../utils/AppError.js";
import { ConcurrencyLimiter } from "../../utils/concurrency.js";
import { inpainter } from "./providers/inpaintingProvider.js";

export type RemovalWarning = "ROUGH_RESULT" | "UNCHANGED";

/** The quality check runs on copies no larger than this. */
const CHECK_SIDE = 800;

/** Mean |dx| + |dy| of a greyscale image over the pixels `include` picks. */
function texture(grey: Buffer, width: number, height: number, include: (i: number) => boolean) {
    let total = 0;
    let count = 0;
    for (let y = 1; y < height; y++) {
        for (let x = 1; x < width; x++) {
            const i = y * width + x;
            if (!include(i)) continue;
            total += Math.abs(grey[i]! - grey[i - 1]!) + Math.abs(grey[i]! - grey[i - width]!);
            count++;
        }
    }
    return count ? total / count : 0;
}

/**
 * Checks what came back: it decodes, it's the same size, it hasn't gained transparency — and the
 * rebuilt area actually changed and has texture like its surroundings (a flat smear reads as a patch).
 */
async function checkResult(input: ImageInput, output: ImageOutput, mask: Buffer): Promise<RemovalWarning[]> {
    let metadata: Metadata;
    try {
        metadata = await sharp(output.buffer).metadata();
    } catch {
        throw new AppError("The selected area could not be reconstructed. Please try again.", 502, "PROCESSING_FAILED");
    }
    if (metadata.width !== input.width || metadata.height !== input.height) {
        throw new AppError("The selected area could not be reconstructed. Please try again.", 502, "PROCESSING_FAILED");
    }
    if (!input.hasAlpha && metadata.hasAlpha && !(await sharp(output.buffer).stats()).isOpaque) {
        throw new AppError("The selected area could not be reconstructed. Please try again.", 502, "PROCESSING_FAILED");
    }

    const scale = Math.min(1, CHECK_SIDE / Math.max(input.width, input.height));
    const size = { width: Math.max(1, Math.round(input.width * scale)), height: Math.max(1, Math.round(input.height * scale)) };
    const grey = (image: Sharp) => image.resize(size.width, size.height, { fit: "fill" }).greyscale().raw().toBuffer();
    const [before, after, selection] = await Promise.all([
        grey(sharp(input.buffer, { limitInputPixels: env.maxImagePixels }).rotate().flatten({ background: "#ffffff" })),
        grey(sharp(output.buffer).flatten({ background: "#ffffff" })),
        sharp(mask).ensureAlpha().extractChannel(3).resize(size.width, size.height, { fit: "fill" }).raw().toBuffer(),
    ]);
    // A ring just outside the selection: what the rebuilt area should look like.
    const ring = await sharp(selection, { raw: { ...size, channels: 1 } }).blur(Math.max(3, size.width / 60)).raw().toBuffer();
    const inside = (i: number) => selection[i]! > 128;
    const around = (i: number) => selection[i]! <= 32 && ring[i]! > 8;

    let changed = 0;
    let insideCount = 0;
    for (let i = 0; i < before.length; i++) {
        if (!inside(i)) continue;
        changed += Math.abs(before[i]! - after[i]!);
        insideCount++;
    }
    if (insideCount < 30) return [];
    if (changed / insideCount < 1.5) return ["UNCHANGED"];
    const rebuilt = texture(after, size.width, size.height, inside);
    const surroundings = texture(after, size.width, size.height, around);
    return surroundings > 4 && rebuilt < surroundings * 0.35 ? ["ROUGH_RESULT"] : [];
}

const limiter = new ConcurrencyLimiter(env.retouch.concurrency, env.maxQueuedJobs);

/** Rebuilds the masked area from its surroundings; the uploaded image itself is never modified. */
export async function removeWatermark({ input, mask, context }: { input: ImageInput; mask: Buffer; context: ProcessingContext }) {
    const output = await limiter.run(() => inpainter.inpaint(input, mask, context), context.signal);
    const warnings = await checkResult(input, output, mask);
    return { output, warnings, engine: inpainter.name };
}
