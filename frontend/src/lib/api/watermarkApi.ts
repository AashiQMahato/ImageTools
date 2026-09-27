import { ApiError, apiClient, type BinaryResult, postFormForBlob, type UploadOptions } from "./apiClient";

export interface WatermarkDetection {
    id: string;
    /** "pattern": the same text repeated across the image. */
    type: "text" | "logo" | "pattern";
    confidence: number;
    box: { x: number; y: number; width: number; height: number };
    /** The region's outline, in image pixels (rotated for slanted text). */
    polygon: [number, number][];
    angle: number;
}

/** Likely watermark regions. Nothing about the image is changed by asking. */
export function detectWatermarks(image: Blob, fileName: string, signal?: AbortSignal) {
    const form = new FormData();
    form.append("file", image, fileName);
    return apiClient.post<{ width: number; height: number; detections: WatermarkDetection[] }>("/watermark/detect", form, { signal });
}

export type RemovalWarning = "ROUGH_RESULT" | "UNCHANGED";

const TIMEOUT_MS = 180_000;

/** The image with the masked area rebuilt; the mask (transparent = keep) travels separately. */
export async function removeWatermark({ image, fileName, mask }: { image: Blob; fileName: string; mask: Blob }, { signal, ...options }: UploadOptions = {}): Promise<BinaryResult & { warnings: RemovalWarning[] }> {
    const form = new FormData();
    form.append("file", image, fileName);
    form.append("mask", mask, "mask.png");
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    try {
        const result = await postFormForBlob("/watermark/remove", form, { ...options, signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
        const warnings = (result.header("X-Quality-Warning") ?? "").split(",").filter(Boolean) as RemovalWarning[];
        return { ...result, warnings };
    } catch (error) {
        if (timeout.aborted) throw new ApiError("Timed out", 408, "PROCESSING_TIMEOUT");
        throw error;
    }
}
