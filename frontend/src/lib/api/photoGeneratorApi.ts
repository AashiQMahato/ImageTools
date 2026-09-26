import { API_BASE_URL, ApiError, apiClient } from "./apiClient";

/** A physical size in the unit the requirement uses (e.g. 1.1 × 1.322 in, 35 × 45 mm). */
export interface PhysicalSize {
    width: number;
    height: number;
    unit: "mm" | "in";
}

export interface PhotoPreset {
    id: string;
    name: string;
    size: PhysicalSize;
    widthMm: number;
    heightMm: number;
    dpi: number;
    width: number;
    height: number;
    background: string;
    sheet: { paper: string; maxCopies: number };
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type StepId = "format" | "orientation" | "face" | "background" | "white" | "composition" | "resolution" | "finalize";
export type WarningCode = "LOW_RESOLUTION" | "BLURRY" | "TOO_DARK" | "TOO_BRIGHT" | "HEAD_TILTED" | "NOT_FACING" | "SMALL_FACE" | "HEAD_AT_EDGE";
export type CheckId = "aspectRatio" | "dimensions" | "dpi" | "whiteBackground" | "faceDetected" | "headVisible" | "headSize" | "centered" | "notStretched";

export interface QualityReport {
    ready: boolean;
    checks: { id: CheckId; ok: boolean }[];
}

export interface RenderedPhoto {
    imageUrl: string;
    pngUrl: string;
    photoId: string;
    width: number;
    height: number;
    widthMm: number;
    heightMm: number;
    size: PhysicalSize;
    dpi: number;
    format: "jpeg";
    quality: QualityReport;
}

export interface HeadMarks {
    crownY: number;
    chinY: number;
    eyeY: number;
    centerX: number;
}

export interface GeneratedPhoto extends RenderedPhoto {
    preset: Omit<PhotoPreset, "sheet">;
    /** The image the crop is taken from, kept by the server for a while so the crop can be adjusted. */
    work: { id: string; url: string; width: number; height: number; crop: Rect; autoCrop: Rect; head: HeadMarks };
    warnings: WarningCode[];
    source: { format: string; converted: boolean; orientationCorrected: boolean; width: number; height: number; upscaled: "ai" | "resample" | null };
}

export type ProgressEvent =
    | { type: "step"; step: StepId; status: "active" | "done" | "skipped"; detail?: { format?: string; converted?: boolean; corrected?: boolean; upscaling?: boolean; upscaled?: "ai" | "resample" | null } }
    | { type: "preview"; stage: "original" | "cutout" | "white"; url: string; width: number; height: number }
    | { type: "crop"; rect: Rect }
    | { type: "warning"; code: WarningCode };

/** Server paths → URLs the browser can load (the API may live on another origin). */
export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const getPhotoPresets = (signal?: AbortSignal) => apiClient.get<PhotoPreset[]>("/photo-generator/presets", { signal });

/** Longer than the server's own limits, so its (friendlier) timeout normally arrives first. */
const TIMEOUT_MS = 180_000;

/**
 * Sends the photo and reports each processing step as the server does it (newline-delimited JSON),
 * resolving with the finished photo. Failures reject with an ApiError carrying a code.
 */
export async function processPhoto(image: File, preset: string, onEvent: (event: ProgressEvent) => void, signal?: AbortSignal): Promise<GeneratedPhoto> {
    const form = new FormData();
    form.append("preset", preset);
    form.append("file", image, image.name || "photo.jpg");
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

    let response: Response;
    try {
        response = await fetch(apiUrl("/api/photo-generator/process"), { method: "POST", body: form, signal: combined });
    } catch (error) {
        throw failure(error, timeout);
    }
    if (!response.ok || !response.body) {
        // Rejected before processing started (size, type, rate limit): a normal JSON error.
        const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
        throw new ApiError(body?.message ?? "Request failed", response.status, body?.code);
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = "";
    try {
        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            pending += value;
            let newline: number;
            while ((newline = pending.indexOf("\n")) >= 0) {
                const line = pending.slice(0, newline).trim();
                pending = pending.slice(newline + 1);
                if (!line) continue;
                const event = JSON.parse(line) as ProgressEvent | { type: "result"; data: GeneratedPhoto } | { type: "error"; code?: string; message?: string };
                if (event.type === "result") return event.data;
                if (event.type === "error") throw new ApiError(event.message ?? "Processing failed", 422, event.code);
                onEvent(event);
            }
        }
    } catch (error) {
        if (error instanceof ApiError) throw error;
        throw failure(error, timeout);
    } finally {
        reader.releaseLock();
    }
    // The stream ended without a result: the connection dropped.
    throw new ApiError("Connection lost", 0, "NETWORK");
}

function failure(error: unknown, timeout: AbortSignal) {
    if (timeout.aborted) return new ApiError("Timed out", 408, "PROCESSING_TIMEOUT");
    if (error instanceof DOMException && error.name === "AbortError") return error;
    return new ApiError("Network error", 0, "NETWORK");
}

export const adjustPhotoCrop = (workId: string, crop: Rect) => apiClient.post<RenderedPhoto & { crop: Rect }>("/photo-generator/adjust", { workId, crop: { ...crop } });

export interface PrintSheet {
    url: string;
    width: number;
    height: number;
    copies: number;
    maxCopies: number;
    paper: string;
    dpi: number;
}

export const createPrintSheet = (photoId: string, copies: number, signal?: AbortSignal) => apiClient.post<PrintSheet>("/photo-generator/sheet", { photoId, copies }, { signal });
