import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/AppError.js";
import type { OcrProvider } from "../types.js";
import { paddleProvider } from "./paddleProvider.js";
import { tesseractProvider } from "./tesseractProvider.js";

/** The engine to use: OCR_PROVIDER, or on "auto" PaddleOCR when installed, else Tesseract. */
export async function getOcrProvider(): Promise<OcrProvider> {
    const order = env.ocr.provider === "paddle" ? [paddleProvider] : env.ocr.provider === "tesseract" ? [tesseractProvider] : [paddleProvider, tesseractProvider];
    for (const provider of order) if (await provider.isAvailable()) return provider;
    throw new AppError("Text recognition isn't set up on this server.", 503, "OCR_UNAVAILABLE");
}
