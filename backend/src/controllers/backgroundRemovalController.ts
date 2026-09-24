import type { RequestHandler } from "express";
import { backgroundRemoval } from "../services/background-removal/backgroundRemovalService.js";
import { validateImage } from "../services/image-processing/imageValidation.service.js";
import { processingContext, safeBaseName, sendImage } from "../utils/http.js";

export const removeBackgroundHandler: RequestHandler = async (req, res) => {
    const input = await validateImage(req.file);
    const output = await backgroundRemoval.remove(input, processingContext(req, res));
    sendImage(res, output, `${safeBaseName(input.originalName)}-no-background.png`, input);
};
