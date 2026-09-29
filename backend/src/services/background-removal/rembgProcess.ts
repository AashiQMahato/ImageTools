import { env } from "../../config/env.js";
import { PythonService, type ServiceStatus } from "../../utils/pythonService.js";

export type RembgStatus = ServiceStatus;

/**
 * The internal Python image service: background removal, plus format conversion, face and watermark
 * detection and inpainting. Launched with the API (or reached at REMBG_SERVICE_URL when run separately).
 */
const service = new PythonService({
    name: "Background removal",
    tag: "[rembg]",
    pythonPath: () => env.rembg.pythonPath,
    cwd: () => env.rembg.serviceDir,
    setupHint: "Run scripts/setup-ml.sh.",
    external: () => {
        if (env.rembg.autostart) return null;
        if (!env.rembg.serviceUrl) return { error: "REMBG_AUTOSTART is off and REMBG_SERVICE_URL is not set." };
        return { url: env.rembg.serviceUrl.replace(/\/$/, ""), token: env.rembg.serviceToken };
    },
    env: () => ({
        REMBG_MODEL: env.rembg.model,
        U2NET_HOME: env.rembg.modelsDir,
        FACE_DETECTOR_MODEL: env.photoGenerator.faceModelPath,
        TEXT_DETECTOR_MODEL: env.watermark.textModelPath,
        INPAINT_MODEL: env.retouch.lamaModelPath,
        MAX_IMAGE_SIZE_MB: String(env.maxImageSizeMb),
        MAX_IMAGE_PIXELS: String(env.maxImagePixels),
        BACKGROUND_REMOVAL_CONCURRENCY: String(env.rembg.concurrency),
        REMBG_DECONTAMINATE: String(env.rembg.decontaminate),
        REMBG_ALPHA_MATTING: String(env.rembg.alphaMatting),
        ...(process.env.REMBG_PROVIDERS ? { REMBG_PROVIDERS: process.env.REMBG_PROVIDERS } : {}),
    }),
});

export const rembgProcess = {
    get state() {
        return { ...service.state, model: env.rembg.model };
    },
    get connection() {
        return service.connection;
    },
    start: () => service.start(),
    stop: () => service.stop(),
};
