import sharp, { type Sharp } from "sharp";
import type { ImageInput, ImageOutput } from "../../types/image.js";

/** Return a result in the same family as the upload: JPEG stays JPEG (much smaller), PNG/WebP keep transparency. */
export async function encodeLike(image: Sharp, input: Pick<ImageInput, "format">): Promise<ImageOutput> {
    let buffer: Buffer;
    let mimeType: string;
    let extension: string;
    if (input.format === "jpeg") {
        buffer = await image.jpeg({ quality: 92, mozjpeg: true }).toBuffer();
        mimeType = "image/jpeg";
        extension = "jpg";
    } else if (input.format === "webp") {
        buffer = await image.webp({ quality: 92, alphaQuality: 100 }).toBuffer();
        mimeType = "image/webp";
        extension = "webp";
    } else {
        buffer = await image.png({ compressionLevel: 6 }).toBuffer();
        mimeType = "image/png";
        extension = "png";
    }
    const { width, height } = await sharp(buffer, { limitInputPixels: false }).metadata();
    return { buffer, mimeType, extension, width: width ?? 0, height: height ?? 0 };
}
