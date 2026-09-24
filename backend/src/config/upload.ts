import { env } from "./env.js";

export const SUPPORTED_FORMATS = {
    jpeg: { mimeType: "image/jpeg", extensions: [".jpg", ".jpeg"] },
    png: { mimeType: "image/png", extensions: [".png"] },
    webp: { mimeType: "image/webp", extensions: [".webp"] },
} as const;

export type SupportedFormat = keyof typeof SUPPORTED_FORMATS;

export const uploadConfig = {
    /** Form field name for the uploaded image. */
    fieldName: "file",
    maxFileSizeBytes: Math.round(env.maxImageSizeMb * 1024 * 1024),
    allowedMimeTypes: Object.values(SUPPORTED_FORMATS).map((format) => format.mimeType) as string[],
    allowedExtensions: Object.values(SUPPORTED_FORMATS).flatMap((format) => format.extensions) as string[],
} as const;

/**
 * First-pass check on what the client *claims*. Some clients (curl, older tools) send a generic type for
 * WebP, so a generic type is allowed when the extension is supported — the real content is verified later.
 */
export function isAcceptableUpload(mimeType: string, fileName: string): boolean {
    const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
    if (!uploadConfig.allowedExtensions.includes(extension)) return false;
    return uploadConfig.allowedMimeTypes.includes(mimeType) || mimeType === "application/octet-stream";
}
