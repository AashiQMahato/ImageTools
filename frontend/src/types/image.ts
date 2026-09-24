export type ProcessingStatus = "idle" | "uploading" | "processing" | "success" | "error";

export interface ImageDimensions {
    width: number;
    height: number;
}

export interface ImageFile {
    id: string;
    file: File;
    name: string;
    size: number;
    mimeType: string;
    /** Object URL for previewing the image in the browser. */
    previewUrl: string;
    dimensions?: ImageDimensions;
}

export interface CropSettings {
    x: number;
    y: number;
    width: number;
    height: number;
    /** Width / height. `undefined` means free-form. */
    aspectRatio?: number;
    zoom: number;
    rotation: number;
}

export type UpscaleFactor = 2 | 4;

export interface UpscaleSettings {
    scale: UpscaleFactor;
}

export interface BackgroundRemovalResult {
    /** URL of the processed image (transparent PNG). */
    imageUrl: string;
    dimensions?: ImageDimensions;
}

export interface UpscaleResult {
    imageUrl: string;
    dimensions?: ImageDimensions;
}
