import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import { isProduction } from "../config/env.js";
import type { ApiFailure } from "../types/api.js";
import { AppError } from "../utils/AppError.js";

export const notFoundHandler: RequestHandler = (req, res) => {
    const body: ApiFailure = { success: false, message: `Route not found: ${req.method} ${req.originalUrl}`, code: "NOT_FOUND" };
    res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    let status = 500;
    let body: ApiFailure = { success: false, message: "Internal server error", code: "INTERNAL_ERROR" };

    if (err instanceof AppError) {
        status = err.statusCode;
        body = { success: false, message: err.message, code: err.code };
    } else if (err instanceof multer.MulterError) {
        status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        body = { success: false, message: err.message, code: err.code };
    } else {
        console.error(err);
        if (!isProduction && err instanceof Error) body.message = err.message;
    }

    res.status(status).json(body);
};
