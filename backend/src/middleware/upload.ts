import multer from "multer";
import { uploadConfig } from "../config/upload.js";
import { AppError } from "../utils/AppError.js";

const allowedMimeTypes: readonly string[] = uploadConfig.allowedMimeTypes;

/** Parses a single image upload into memory (no disk or cloud storage). */
export const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadConfig.maxFileSizeBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
        if (allowedMimeTypes.includes(file.mimetype)) {
            callback(null, true);
        } else {
            callback(new AppError(`Unsupported file type. Allowed: ${allowedMimeTypes.join(", ")}`, 415, "UNSUPPORTED_MEDIA_TYPE"));
        }
    },
}).single(uploadConfig.fieldName);
