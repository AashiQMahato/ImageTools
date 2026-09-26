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

/**
 * The retouch upload: the image (`file`) and the selection painted over it (`mask`, a PNG whose
 * transparency is the selection), sent separately and never merged. Both are checked for real later.
 */
export const uploadRetouch = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadConfig.maxFileSizeBytes, files: 2, fields: 6, fieldSize: 1024, parts: 8 },
    fileFilter: (_req, file, callback) => {
        const accepted = file.fieldname === "mask" ? file.mimetype === "image/png" : isAcceptableUpload(file.mimetype, file.originalname);
        if (accepted) callback(null, true);
        else if (file.fieldname === "mask") callback(new AppError("The selection couldn't be read. Please paint the area again.", 422, "INVALID_MASK"));
        else callback(new AppError("Unsupported file type. Please upload a JPG, PNG or WebP image.", 415, "UNSUPPORTED_MEDIA_TYPE"));
    },
}).fields([
    { name: uploadConfig.fieldName, maxCount: 1 },
    { name: "mask", maxCount: 1 },
]);
