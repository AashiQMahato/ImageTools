import { Router } from "express";
import { removeBackgroundHandler } from "../controllers/backgroundRemovalController.js";
import { getHealth } from "../controllers/healthController.js";
import { upscaleHandler } from "../controllers/upscaleController.js";
import { uploadImage } from "../middleware/upload.js";

export const apiRouter = Router();

apiRouter.get("/health", getHealth);
apiRouter.post("/remove-background", uploadImage, removeBackgroundHandler);
apiRouter.post("/upscale", uploadImage, upscaleHandler);
