import { postFormForBlob, type UploadOptions } from "./apiClient";

export type QualityPreset = "maximum" | "high" | "balanced" | "small" | "minimum";
export type OutputFormat = "auto" | "jpeg" | "png" | "webp";

export interface CompressSettings {
    preset: QualityPreset;
    /** Overrides the preset's quality (1–100). */
    quality: number | null;
    format: OutputFormat;
    /** Aim for a file size, if set. */
    target: { size: number; unit: "KB" | "MB" } | null;
    /** Longest side in pixels; null keeps the original size. */
    maxSide: number | null;
    stripMetadata: boolean;
    progressive: boolean;
}

export interface CompressedImage {
    blob: Blob;
    fileName: string;
    size: number;
    originalSize: number;
    width: number;
    height: number;
    format: Exclude<OutputFormat, "auto">;
    quality: number;
    resized: boolean;
    /** Only when a target was set. */
    targetMet: boolean | null;
    /** Transparency was filled with white (JPEG can't keep it). */
    flattened: boolean;
    /** Already as small as these settings allow — the original came back unchanged. */
    alreadyOptimal: boolean;
}

/** Compresses one image on the server; the result comes back as the file itself, plus what was done. */
export async function compressImage(file: File, settings: CompressSettings, options?: UploadOptions): Promise<CompressedImage> {
    const form = new FormData();
    form.append("qualityPreset", settings.preset);
    if (settings.quality !== null) form.append("quality", String(settings.quality));
    form.append("outputFormat", settings.format);
    if (settings.target) {
        form.append("targetSize", String(settings.target.size));
        form.append("targetUnit", settings.target.unit);
    }
    if (settings.maxSide) {
        form.append("maxWidth", String(settings.maxSide));
        form.append("maxHeight", String(settings.maxSide));
    }
    form.append("stripMetadata", String(settings.stripMetadata));
    form.append("progressive", String(settings.progressive));
    form.append("file", file, file.name);

    const response = await postFormForBlob("/compress", form, options);
    const header = (name: string) => response.header(name);
    const format = (header("X-Output-Format") ?? "jpeg") as CompressedImage["format"];
    const met = header("X-Target-Met");
    return {
        blob: response.blob,
        fileName: response.fileName ?? file.name,
        size: Number(header("X-Compressed-Size")) || response.blob.size,
        originalSize: Number(header("X-Original-Size")) || file.size,
        width: response.width,
        height: response.height,
        format,
        quality: Number(header("X-Quality")) || 0,
        resized: header("X-Resized") === "true",
        targetMet: met === null ? null : met === "true",
        flattened: header("X-Flattened") === "true",
        alreadyOptimal: header("X-Already-Optimal") === "true",
    };
}
