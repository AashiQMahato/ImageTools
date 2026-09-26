import sharp, { type Sharp } from "sharp";
import type { ProcessingContext } from "../../types/image.js";
import { backgroundRemoval } from "../background-removal/backgroundRemovalService.js";

/** The subject on transparency, plus its alpha as one byte per pixel for measuring the head. */
export interface Cutout {
    /** RGBA PNG, same size as the photo. */
    png: Buffer;
    alpha: Buffer;
    width: number;
    height: number;
}

/**
 * Separates the person from the background through the app's background-removal service, so this
 * uses whichever model/provider that service is configured with — nothing here is tied to one.
 */
export async function removeBackground(photo: { buffer: Buffer; width: number; height: number }, context: ProcessingContext): Promise<Cutout> {
    const output = await backgroundRemoval.remove(
        { buffer: photo.buffer, originalName: "photo.jpg", format: "jpeg", width: photo.width, height: photo.height, hasAlpha: false },
        context,
    );
    // The model works on the pixels as sent (already upright), so the cut-out lines up with the photo.
    const image = sharp(output.buffer).ensureAlpha().resize(photo.width, photo.height, { fit: "fill" });
    const [png, alpha] = await Promise.all([image.clone().png().toBuffer(), image.clone().extractChannel(3).raw().toBuffer()]);
    return { png, alpha, width: photo.width, height: photo.height };
}

/**
 * The subject over a clean, flat background (pure white for ID photos): no gradient, no shadow. Each
 * pixel is blended with the background by its own alpha, so soft hair edges stay soft instead of
 * gaining a halo.
 */
export function createWhiteBackground(rgba: Sharp, background = "#ffffff"): Sharp {
    return rgba.flatten({ background });
}
