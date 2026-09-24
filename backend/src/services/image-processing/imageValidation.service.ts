import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { env } from "../../config/env.js";
import { isAcceptableUpload, type SupportedFormat, uploadConfig } from "../../config/upload.js";
import type { ImageInput } from "../../types/image.js";
import { AppError } from "../../utils/AppError.js";

/** Identify the real format from the file's leading bytes — never from its name or declared type. */
function sniffFormat(buffer: Buffer): SupportedFormat | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
    if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
    return null;
}

const unsupported = () =>
    new AppError("Unsupported file type. Please upload a JPG, PNG or WebP image.", 415, "UNSUPPORTED_MEDIA_TYPE");
const unreadable = () => new AppError("This file couldn't be read as an image. It may be damaged.", 422, "INVALID_IMAGE");

/**
 * Validates an uploaded file end to end: presence, size, extension, declared type, real content signature,
 * and a full decode (which catches truncated or malformed files and oversized dimensions).
 */
export async function validateImage(file: Express.Multer.File | undefined): Promise<ImageInput> {
    if (!file || file.size === 0) throw new AppError("Please choose an image to upload.", 400, "FILE_REQUIRED");
    if (file.size > uploadConfig.maxFileSizeBytes) {
        throw new AppError(`The image is too large. Please upload an image under ${env.maxImageSizeMb} MB.`, 413, "FILE_TOO_LARGE");
    }

    if (!isAcceptableUpload(file.mimetype, file.originalname)) throw unsupported();

    // The bytes decide the format. A renamed file (".jpg" that is really PNG) is fine as long as the real
    // content is one of the supported formats.
    const format = sniffFormat(file.buffer);
    if (!format) throw unsupported();

    let metadata: Metadata;
    try {
        const image = sharp(file.buffer, { failOn: "error", limitInputPixels: env.maxImagePixels });
        metadata = await image.metadata();
        // metadata() only reads the header; decoding a small preview proves the pixel data itself is intact.
        await image.clone().resize(64, 64, { fit: "inside" }).raw().toBuffer();
    } catch (error) {
        if (error instanceof Error && /pixel limit/i.test(error.message)) {
            throw new AppError("The image dimensions are too large. Please upload a smaller image.", 413, "IMAGE_TOO_LARGE");
        }
        throw unreadable();
    }

    if (metadata.format !== format || !metadata.width || !metadata.height) throw unreadable();

    // EXIF orientations 5–8 swap width and height when displayed.
    const rotated = (metadata.orientation ?? 1) >= 5;
    return {
        buffer: file.buffer,
        originalName: path.basename(file.originalname),
        format,
        width: rotated ? metadata.height : metadata.width,
        height: rotated ? metadata.width : metadata.height,
        hasAlpha: metadata.hasAlpha ?? false,
    };
}
