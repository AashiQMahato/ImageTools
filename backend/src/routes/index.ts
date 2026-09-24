import { Router } from "express";
import { removeBackgroundHandler } from "../controllers/backgroundRemovalController.js";
import { getHealth, getProcessorHealth } from "../controllers/healthController.js";
import { upscaleHandler } from "../controllers/upscaleController.js";
import { processingRateLimiter } from "../middleware/rateLimiter.js";
import { uploadImage } from "../middleware/upload.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.get("/health/processors", getProcessorHealth);
apiRouter.post("/remove-background", processingRateLimiter, uploadImage, removeBackgroundHandler);
apiRouter.post("/upscale", processingRateLimiter, uploadImage, upscaleHandler);
