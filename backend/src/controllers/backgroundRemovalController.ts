import type { RequestHandler } from "express";
import { removeBackground } from "../services/background-removal/backgroundRemovalService.js";
import { toImageInput } from "../utils/image.js";

export const removeBackgroundHandler: RequestHandler = async (req, res) => {
    // Errors (including NotImplementedError → 501) propagate to the error handler.
    const result = await removeBackground(toImageInput(req.file));
    res.type(result.mimeType).send(result.buffer);
};
