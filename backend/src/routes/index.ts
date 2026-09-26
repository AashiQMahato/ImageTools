import { Router } from "express";
import { removeBackgroundHandler } from "../controllers/backgroundRemovalController.js";
import { getHealth, getProcessorHealth } from "../controllers/healthController.js";
import { adjustCropHandler, convertHandler, fileHandler, presetsHandler, processHandler, sheetHandler } from "../controllers/photoGeneratorController.js";
import { upscaleHandler } from "../controllers/upscaleController.js";
import { retouchHandler } from "../controllers/retouchController.js";
import { processingRateLimiter } from "../middleware/rateLimiter.js";
import { uploadImage, uploadPhoto, uploadRetouch } from "../middleware/upload.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.get("/health/processors", getProcessorHealth);
apiRouter.post("/remove-background", processingRateLimiter, uploadImage, removeBackgroundHandler);
apiRouter.post("/upscale", processingRateLimiter, uploadImage, upscaleHandler);
apiRouter.post("/retouch", processingRateLimiter, uploadRetouch, retouchHandler);
apiRouter.post("/convert", processingRateLimiter, uploadPhoto, convertHandler);

apiRouter.get("/photo-generator/presets", presetsHandler);
apiRouter.post("/photo-generator/process", processingRateLimiter, uploadPhoto, processHandler);
apiRouter.post("/photo-generator/adjust", adjustCropHandler);
apiRouter.post("/photo-generator/sheet", sheetHandler);
apiRouter.get("/photo-generator/files/:id", fileHandler);
