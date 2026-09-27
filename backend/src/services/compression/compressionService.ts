import sharp, { type OutputInfo, type Sharp } from "sharp";
import { env } from "../../config/env.js";
import type { ImageInput, ProcessingContext } from "../../types/image.js";
import { AppError } from "../../utils/AppError.js";
import { ConcurrencyLimiter } from "../../utils/concurrency.js";
import { analyzeImage, chooseFormat, type OutputFormat } from "./analysis.js";

export type QualityPreset = "maximum" | "high" | "balanced" | "small" | "minimum";

export const QUALITY_PRESETS: Record<QualityPreset, { quality: number; fullColour: boolean }> = {
    maximum: { quality: 92, fullColour: true },
    high: { quality: 84, fullColour: true },
    balanced: { quality: 74, fullColour: false },
    small: { quality: 60, fullColour: false },
    minimum: { quality: 45, fullColour: false },
};

export interface CompressionOptions {
    preset: QualityPreset;
    /** Overrides the preset's quality (1–100). */
    quality?: number;
    format: OutputFormat | "auto";
    /** Bytes. The result is the best quality at or under it, if it can be reached. */
    targetBytes?: number;
    /** Longest-side limits; the image is never enlarged. */
    maxWidth?: number;
    maxHeight?: number;
    stripMetadata: boolean;
    progressive: boolean;
}

export interface CompressionResult {
    buffer: Buffer;
    format: OutputFormat;
    extension: string;
    mimeType: string;
    width: number;
    height: number;
    quality: number;
    /** Scaled down (by the settings, or to reach the target). */
    resized: boolean;
    /** Only when a target was set. */
    targetMet?: boolean;
    /** Transparency was filled with white (JPEG can't hold it). */
    flattened: boolean;
    /** Already as small as these settings can make it: the original is returned unchanged. */
    alreadyOptimal: boolean;
}

/** Below this quality, lossy images degrade fast — it's better to reduce the size instead. */
const QUALITY_FLOOR = 50;
/** Smallest long side smart resizing will go to. */
const MIN_SIDE = 160;
/** Quality steps of a binary search: ~6 encodes find the best quality within one point. */
const SEARCH_STEPS = 6;

const MIME: Record<OutputFormat, { mimeType: string; extension: string }> = {
    jpeg: { mimeType: "image/jpeg", extension: "jpg" },
    png: { mimeType: "image/png", extension: "png" },
    webp: { mimeType: "image/webp", extension: "webp" },
};

/**
 * Encodes one attempt. Every attempt starts from the same decoded, upright pixels (or, when metadata
 * is kept, from the original with its EXIF/ICC), so nothing is ever re-compressed twice.
 */
class Encoder {
    private readonly scaled = new Map<string, Promise<{ data: Buffer; info: OutputInfo }>>();

    constructor(
        private readonly input: ImageInput,
        private readonly format: OutputFormat,
        private readonly options: CompressionOptions,
        private readonly flatten: boolean,
    ) {}

    /** Upright pixels at a size, decoded once per size. */
    private pixels(width: number, height: number) {
        const key = `${width}x${height}`;
        let cached = this.scaled.get(key);
        if (!cached) {
            let image = sharp(this.input.buffer, { limitInputPixels: env.maxImagePixels }).rotate();
            if (width !== this.input.width || height !== this.input.height) image = image.resize(width, height, { fit: "fill", kernel: "lanczos3" });
            if (this.flatten) image = image.flatten({ background: "#ffffff" });
            cached = image.raw().toBuffer({ resolveWithObject: true });
            this.scaled.set(key, cached);
        }
        return cached;
    }

    async encode(quality: number, width: number, height: number): Promise<Buffer> {
        let image: Sharp;
        if (this.options.stripMetadata) {
            const { data, info } = await this.pixels(width, height);
            image = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
        } else {
            // Keeping EXIF/ICC means starting from the original file each time.
            image = sharp(this.input.buffer, { limitInputPixels: env.maxImagePixels }).rotate().keepMetadata();
            if (width !== this.input.width || height !== this.input.height) image = image.resize(width, height, { fit: "fill", kernel: "lanczos3" });
            if (this.flatten) image = image.flatten({ background: "#ffffff" });
        }
        const q = Math.round(Math.min(100, Math.max(1, quality)));
        const fullColour = this.options.quality ? q >= 84 : QUALITY_PRESETS[this.options.preset].fullColour;
        switch (this.format) {
            case "jpeg":
                return image.jpeg({ quality: q, mozjpeg: true, progressive: this.options.progressive, chromaSubsampling: fullColour ? "4:4:4" : "4:2:0" }).toBuffer();
            case "webp":
                return image.webp({ quality: q, alphaQuality: Math.max(q, 80), effort: 5, smartSubsample: true }).toBuffer();
            case "png":
                // Top quality stays lossless; below it, a colour palette whose size follows the quality.
                return q >= 92
                    ? image.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 8 }).toBuffer()
                    : image.png({ palette: true, quality: q, effort: 8, compressionLevel: 9, dither: 1 }).toBuffer();
        }
    }
}

/** The size after the user's own limits (never enlarged, aspect kept). */
function limitedSize(input: ImageInput, { maxWidth, maxHeight }: CompressionOptions) {
    const scale = Math.min(1, maxWidth ? maxWidth / input.width : 1, maxHeight ? maxHeight / input.height : 1);
    return { width: Math.max(1, Math.round(input.width * scale)), height: Math.max(1, Math.round(input.height * scale)) };
}

async function compress(input: ImageInput, originalSize: number, options: CompressionOptions, { signal }: ProcessingContext): Promise<CompressionResult> {
    const analysis = await analyzeImage(input);
    const format = chooseFormat(options.format, input, analysis);
    const flattened = format === "jpeg" && analysis.transparent;
    const encoder = new Encoder(input, format, options, format === "jpeg" && input.hasAlpha);
    const quality = options.quality ?? QUALITY_PRESETS[options.preset].quality;
    let size = limitedSize(input, options);
    const cancelled = () => {
        if (signal.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
    };
    const result = (buffer: Buffer, q: number, targetMet?: boolean): CompressionResult => ({
        buffer,
        format,
        ...MIME[format],
        ...size,
        quality: q,
        resized: size.width !== input.width || size.height !== input.height,
        targetMet,
        flattened,
        alreadyOptimal: false,
    });

    const target = options.targetBytes;
    if (!target) {
        const buffer = await encoder.encode(quality, size.width, size.height);
        // Never hand back something bigger than what came in, for the same image in the same format.
        const same = format === input.format && size.width === input.width && size.height === input.height && !flattened;
        if (same && buffer.length >= originalSize) return { ...result(input.buffer, quality), alreadyOptimal: true };
        return result(buffer, quality);
    }

    // Aim for the highest quality at or under the target: first as-is, then — rather than crushing the
    // quality — at a smaller size, re-searching each time.
    const floor = Math.min(quality, QUALITY_FLOOR);
    let smallest: { buffer: Buffer; quality: number; size: typeof size } | null = null;
    for (let round = 0; round < 8; round++) {
        cancelled();
        const top = await encoder.encode(quality, size.width, size.height);
        if (top.length <= target) return result(top, quality, true);
        const bottom = await encoder.encode(floor, size.width, size.height);
        if (!smallest || bottom.length < smallest.buffer.length) smallest = { buffer: bottom, quality: floor, size };
        if (bottom.length <= target) {
            let low = floor;
            let high = quality;
            let best = { buffer: bottom, quality: floor };
            for (let step = 0; step < SEARCH_STEPS && high - low > 1; step++) {
                cancelled();
                const middle = Math.round((low + high) / 2);
                const attempt = await encoder.encode(middle, size.width, size.height);
                if (attempt.length <= target) {
                    best = { buffer: attempt, quality: middle };
                    low = middle;
                } else high = middle;
            }
            return result(best.buffer, best.quality, true);
        }
        // Even the floor quality is too big: shrink by roughly what the bytes say, then search again.
        const factor = Math.min(0.9, Math.sqrt(target / bottom.length) * 0.95);
        const next = { width: Math.round(size.width * factor), height: Math.round(size.height * factor) };
        if (Math.max(next.width, next.height) < MIN_SIDE) break;
        size = next;
    }
    // Not reachable without ruining the picture: the best that could be done, marked as such.
    size = smallest!.size;
    return result(smallest!.buffer, smallest!.quality, false);
}

const limiter = new ConcurrencyLimiter(env.compression.concurrency, env.maxQueuedJobs);

export const compression = {
    compress: (input: ImageInput, originalSize: number, options: CompressionOptions, context: ProcessingContext) =>
        limiter.run(() => compress(input, originalSize, options, context), context.signal),
};
