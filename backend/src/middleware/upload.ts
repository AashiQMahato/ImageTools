import multer from "multer";
import { isAcceptableUpload, uploadConfig } from "../config/upload.js";
import { AppError } from "../utils/AppError.js";

/**
 * Parses a single image upload into memory (no disk or cloud storage). This is a first, cheap filter on the
 * declared type; the real content is verified by decoding it in imageValidation.service.
 */
export const uploadImage = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadConfig.maxFileSizeBytes, files: 1, fields: 4, fieldSize: 1024, parts: 6 },
    fileFilter: (_req, file, callback) => {
        if (isAcceptableUpload(file.mimetype, file.originalname)) {
            callback(null, true);
        } else {
            callback(new AppError("Unsupported file type. Please upload a JPG, PNG or WebP image.", 415, "UNSUPPORTED_MEDIA_TYPE"));
        }
    },
}).single(uploadConfig.fieldName);
