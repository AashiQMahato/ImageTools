import { Router } from "express";
import { removeBackgroundHandler } from "../controllers/backgroundRemovalController.js";
import { getHealth, getProcessorHealth } from "../controllers/healthController.js";
import { upscaleHandler } from "../controllers/upscaleController.js";
import { retouchHandler } from "../controllers/retouchController.js";
import { processingRateLimiter } from "../middleware/rateLimiter.js";
import { uploadImage, uploadRetouch } from "../middleware/upload.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.get("/health/processors", getProcessorHealth);
apiRouter.post("/remove-background", processingRateLimiter, uploadImage, removeBackgroundHandler);
apiRouter.post("/upscale", processingRateLimiter, uploadImage, upscaleHandler);
apiRouter.post("/retouch", processingRateLimiter, uploadRetouch, retouchHandler);
