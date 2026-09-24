import type { SupportedFormat } from "../config/upload.js";

/** An upload that has passed validation: its real format and dimensions come from decoding it. */
export interface ImageInput {
    buffer: Buffer;
    originalName: string;
    format: SupportedFormat;
    width: number;
    height: number;
    hasAlpha: boolean;
}

export interface ImageOutput {
    buffer: Buffer;
    mimeType: string;
    /** Extension for the download filename, without the dot. */
    extension: string;
    width: number;
    height: number;
}

export type UpscaleScale = 2 | 4;

export interface UpscaleOptions {
    scale: UpscaleScale;
}

export interface ProcessingContext {
    /** Aborted when the client disconnects or the request times out. */
    signal: AbortSignal;
}

/** Contract every background-removal provider must implement, so providers can be swapped. */
export interface BackgroundRemovalProvider {
    readonly name: string;
    isAvailable(): boolean;
    removeBackground(input: ImageInput, context: ProcessingContext): Promise<ImageOutput>;
}

/** Contract every upscaling provider must implement, so providers can be swapped. */
export interface UpscaleProvider {
    readonly name: string;
    isAvailable(): boolean;
    upscale(input: ImageInput, options: UpscaleOptions, context: ProcessingContext): Promise<ImageOutput>;
}
