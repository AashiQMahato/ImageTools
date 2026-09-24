export interface ImageInput {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
}

export interface ImageOutput {
    buffer: Buffer;
    mimeType: string;
    width?: number;
    height?: number;
}

export interface UpscaleOptions {
    scale: 2 | 4;
}

/** Contract every background-removal provider must implement, so providers can be swapped. */
export interface BackgroundRemovalProvider {
    readonly name: string;
    removeBackground(input: ImageInput): Promise<ImageOutput>;
}

/** Contract every upscaling provider must implement, so providers can be swapped. */
export interface UpscaleProvider {
    readonly name: string;
    upscale(input: ImageInput, options: UpscaleOptions): Promise<ImageOutput>;
}
