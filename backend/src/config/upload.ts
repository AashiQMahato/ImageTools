export const uploadConfig = {
    /** Form field name for the uploaded image. */
    fieldName: "image",
    maxFileSizeBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
} as const;
