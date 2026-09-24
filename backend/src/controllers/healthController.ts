import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { backgroundRemoval } from "../services/background-removal/backgroundRemovalService.js";
import { rembgProcess } from "../services/background-removal/rembgProcess.js";
import { upscaylProvider } from "../services/upscaling/upscaylProvider.js";
import { upscaling } from "../services/upscaling/upscaleService.js";

export const getHealth: RequestHandler = (_req, res) => {
    res.json({
        success: true,
        message: "Image Tools API is running",
        services: {
            api: true,
            backgroundRemoval: backgroundRemoval.isAvailable(),
            upscaling: upscaling.isAvailable(),
        },
    });
};

/** Processor details for operators and the frontend. No paths, tokens or raw errors. */
export const getProcessorHealth: RequestHandler = (_req, res) => {
    const rembg = rembgProcess.state;
    const upscayl = upscaylProvider.state;
    res.json({
        success: true,
        data: {
            backgroundRemoval: {
                available: backgroundRemoval.isAvailable(),
                status: rembg.status,
                engine: "rembg",
                model: rembg.model,
                queue: backgroundRemoval.stats(),
            },
            upscaling: {
                available: upscaling.isAvailable(),
                status: upscayl.status,
                reason: upscayl.reason,
                message: upscaling.isAvailable() ? null : upscaylProvider.unavailableMessage,
                engine: "upscayl-ncnn",
                model: upscayl.model,
                gpuAcceleration: upscayl.status === "ready",
                gpu: upscayl.gpu,
                scales: [2, 4],
                queue: upscaling.stats(),
            },
            limits: {
                maxFileSizeMb: env.maxImageSizeMb,
                formats: ["image/jpeg", "image/png", "image/webp"],
            },
        },
    });
};
