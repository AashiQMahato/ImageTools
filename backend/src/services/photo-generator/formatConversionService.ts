import sharp, { type Metadata } from "sharp";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { postToImageService } from "../image-processing/internalImageService.js";

export type SourceFormat = "jpeg" | "png" | "webp" | "heif" | "avif" | "tiff" | "bmp" | "gif";

/** Formats this server's image library reads directly; the rest are converted by the Python service. */
const NATIVE: ReadonlySet<SourceFormat> = new Set(["jpeg", "png", "webp", "avif", "tiff", "gif"]);

/** An upright, full-resolution JPEG every later step can work on. */
export interface NormalizedImage {
    buffer: Buffer;
    width: number;
    height: number;
    sourceFormat: SourceFormat;
    /** The upload was in a format that had to be converted first (e.g. HEIC). */
    converted: boolean;
    /** The photo was stored rotated (EXIF orientation) and has been turned upright. */
    orientationCorrected: boolean;
}

/** The real format, from the file's leading bytes — never from its name or declared type. */
export function detectFormat(buffer: Buffer): SourceFormat | null {
    if (buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    if (buffer.toString("ascii", 0, 3) === "GIF") return "gif";
    if (buffer.toString("ascii", 0, 2) === "BM") return "bmp";
    if ((buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a) || (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[3] === 0x2a)) return "tiff";
    if (buffer.toString("ascii", 4, 8) === "ftyp") {
        // ISO-BMFF: the major and compatible brands say whether it's AVIF or HEIC/HEIF.
        const boxSize = Math.min(buffer.readUInt32BE(0), buffer.length, 64);
        const brands: string[] = [];
        for (let offset = 8; offset + 4 <= boxSize; offset += 4) brands.push(buffer.toString("ascii", offset, offset + 4));
        if (brands.includes("avif") || brands.includes("avis")) return "avif";
        if (brands.some((brand) => ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand))) return "heif";
    }
    return null;
}

const unsupported = () => new AppError("This image format isn't supported. Please use a JPG, PNG, WebP or HEIC photo.", 415, "UNSUPPORTED_MEDIA_TYPE");

/**
 * Formats the server can't read natively (HEIC/HEIF, BMP) become a maximum-quality JPEG, turned upright
 * and with their colour profile kept. Anything else is returned untouched.
 */
export async function convertImage(buffer: Buffer, format: SourceFormat, signal: AbortSignal): Promise<{ buffer: Buffer; converted: boolean; orientation: number | null }> {
    if (NATIVE.has(format)) return { buffer, converted: false, orientation: null };
    const response = await postToImageService("/convert", buffer, `upload.${format}`, signal, env.photoGenerator.timeoutMs, {
        code: "CONVERSION_FAILED",
        message: "We couldn't convert this photo. Please try a JPG or PNG instead.",
    });
    const orientation = Number(response.headers.get("x-source-orientation")) || 1;
    return { buffer: Buffer.from(await response.arrayBuffer()), converted: true, orientation };
}

/**
 * Upright and uniform: EXIF orientation applied (before any detection or cropping), transparency on
 * white, colour profile kept, full resolution, as a high-quality JPEG. EXIF is dropped — it can hold
 * the photo's location, and nothing downstream needs it.
 */
export async function normalizeImage(buffer: Buffer, previousOrientation: number | null): Promise<{ buffer: Buffer; width: number; height: number; orientationCorrected: boolean }> {
    let metadata: Metadata;
    try {
        metadata = await sharp(buffer, { failOn: "error", limitInputPixels: env.maxImagePixels }).metadata();
    } catch (error) {
        if (error instanceof Error && /pixel limit/i.test(error.message)) throw new AppError("The image dimensions are too large. Please upload a smaller image.", 413, "IMAGE_TOO_LARGE");
        throw new AppError("This file couldn't be read as an image. It may be damaged.", 422, "INVALID_IMAGE");
    }
    const orientation = metadata.orientation ?? 1;
    try {
        const { data, info } = await sharp(buffer, { failOn: "error", limitInputPixels: env.maxImagePixels, pages: 1 })
            .rotate()
            .flatten({ background: "#ffffff" })
            .keepIccProfile()
            .jpeg({ quality: 95, chromaSubsampling: "4:4:4", mozjpeg: true })
            .toBuffer({ resolveWithObject: true });
        return { buffer: data, width: info.width, height: info.height, orientationCorrected: orientation > 1 || (previousOrientation ?? 1) > 1 };
    } catch {
        throw new AppError("This file couldn't be read as an image. It may be damaged.", 422, "INVALID_IMAGE");
    }
}

/** Detect → convert when needed → normalize. */
export async function prepareImage(upload: Buffer, signal: AbortSignal): Promise<NormalizedImage> {
    const sourceFormat = detectFormat(upload);
    if (!sourceFormat) throw unsupported();
    const converted = await convertImage(upload, sourceFormat, signal);
    const normalized = await normalizeImage(converted.buffer, converted.orientation);
    return { ...normalized, sourceFormat, converted: converted.converted };
}
