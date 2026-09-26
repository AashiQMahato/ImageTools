export type ProcessingStatus = "idle" | "selected" | "uploading" | "processing" | "success" | "error" | "unsupported";

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
    dimensions: ImageDimensions;
    /** The tool whose result this is; absent for an image as uploaded. */
    editedBy?: string;
}

/** A processed image held in the browser only (never stored on the server). */
export interface ProcessedImage {
    blob: Blob;
    /** Object URL; revoked when the result is discarded. */
    url: string;
    fileName: string;
    dimensions: ImageDimensions;
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
