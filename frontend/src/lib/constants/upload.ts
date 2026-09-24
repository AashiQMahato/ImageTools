/** Mirrors backend/src/config/upload.ts so files are validated before they leave the browser. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const UPLOAD_HINT = "JPG, PNG or WebP · up to 10 MB";
