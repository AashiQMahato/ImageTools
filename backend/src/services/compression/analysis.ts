import sharp from "sharp";
import { env } from "../../config/env.js";
import type { ImageInput } from "../../types/image.js";

export type OutputFormat = "jpeg" | "png" | "webp";

/** What kind of image this is — it decides which format compresses it best. */
export interface ImageAnalysis {
    /** Some pixels are actually transparent (not just an alpha channel that's all opaque). */
    transparent: boolean;
    /** Few distinct colours (logos, screenshots, diagrams): lossless palettes beat JPEG here. */
    graphic: boolean;
}

/** Distinct colours in a 96-px thumbnail; photos have thousands, graphics a handful. */
const GRAPHIC_MAX_COLOURS = 400;

export async function analyzeImage(input: ImageInput): Promise<ImageAnalysis> {
    const image = sharp(input.buffer, { limitInputPixels: env.maxImagePixels });
    const transparent = input.hasAlpha ? !(await image.clone().stats()).isOpaque : false;
    // Nearest-neighbour, so the thumbnail samples real pixels instead of blending new colours in.
    const { data, info } = await image.clone().resize(96, 96, { fit: "inside", kernel: "nearest" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const colours = new Set<number>();
    for (let i = 0; i < data.length && colours.size <= GRAPHIC_MAX_COLOURS; i += info.channels) colours.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    return { transparent, graphic: colours.size <= GRAPHIC_MAX_COLOURS };
}

/**
 * "Auto": photos → JPEG (or stay WebP), anything with real transparency → WebP (keeps it, far smaller
 * than PNG), flat graphics → PNG with a palette.
 */
export function chooseFormat(requested: OutputFormat | "auto", input: ImageInput, analysis: ImageAnalysis): OutputFormat {
    if (requested !== "auto") return requested;
    if (analysis.transparent) return "webp";
    if (analysis.graphic) return "png";
    return input.format === "webp" ? "webp" : "jpeg";
}
