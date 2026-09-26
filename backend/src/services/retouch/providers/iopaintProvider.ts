import sharp from "sharp";
import { env } from "../../../config/env.js";
import type { ProcessingContext, RawImage, RawMask, RetouchMode, RetouchOptions, RetouchProvider } from "../../../types/image.js";
import { AppError } from "../../../utils/AppError.js";

const failed = () => new AppError("We couldn't process this image. Please try again.", 502, "PROCESSING_FAILED");

/**
 * AI inpainting through a self-hosted IOPaint server (https://github.com/Sanster/IOPaint), normally
 * running the LaMa model: `iopaint start --model=lama --port=8080`. It reconstructs whatever is under
 * the mask from the surrounding scene — people, wires, signs — far beyond what filters can do.
 *
 * Only the region around the selection is sent, already scaled to a workable size. Set
 * RETOUCH_SERVICE_URL to enable it; nothing else changes.
 */
class IopaintProvider implements RetouchProvider {
    readonly name = "iopaint-lama";

    isAvailable() {
        return Boolean(env.retouch.serviceUrl);
    }

    supports(mode: RetouchMode) {
        return mode === "remove" || mode === "heal";
    }

    async retouch(image: RawImage, mask: RawMask, _options: RetouchOptions, { signal }: ProcessingContext): Promise<RawImage> {
        const { width, height } = image;
        const [imagePng, maskPng] = await Promise.all([
            sharp(image.data, { raw: { width, height, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer(),
            sharp(mask.data, { raw: { width, height, channels: 1 } }).png({ compressionLevel: 1 }).toBuffer(),
        ]);

        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, env.retouch.timeoutMs);
        const onAbort = () => controller.abort();
        signal.addEventListener("abort", onAbort, { once: true });

        let body: Buffer;
        try {
            const response = await fetch(`${env.retouch.serviceUrl}/api/v1/inpaint`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    image: `data:image/png;base64,${imagePng.toString("base64")}`,
                    // White is the area to rebuild.
                    mask: `data:image/png;base64,${maskPng.toString("base64")}`,
                }),
                signal: controller.signal,
            });
            if (!response.ok) {
                console.error(`Retouch service responded ${response.status}`);
                throw failed();
            }
            body = Buffer.from(await response.arrayBuffer());
        } catch (error) {
            if (error instanceof AppError) throw error;
            if (signal.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
            if (timedOut) throw new AppError("Retouching took too long. Please try a smaller area.", 504, "PROCESSING_TIMEOUT");
            console.error("Retouch service unreachable:", error instanceof Error ? error.message : error);
            throw new AppError("Retouching is temporarily unavailable. Please try again in a moment.", 503, "RETOUCH_UNAVAILABLE");
        } finally {
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
        }

        try {
            // Models may pad or round the size; bring it back to exactly what was sent.
            const data = await sharp(body, { limitInputPixels: env.maxImagePixels }).removeAlpha().resize(width, height, { fit: "fill" }).raw().toBuffer();
            return { data, width, height };
        } catch {
            throw failed();
        }
    }
}

export const iopaintProvider = new IopaintProvider();
