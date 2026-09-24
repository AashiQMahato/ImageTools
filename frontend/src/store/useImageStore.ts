import { create } from "zustand";
import type { ImageFile, ProcessingStatus } from "@/types/image";

/**
 * Shared state for the image currently being worked on.
 * Tool-specific settings (crop, upscale, ...) will be added as slices when those features are built.
 */
interface ImageState {
    original: ImageFile | null;
    /** Object URL of the latest processed result. */
    resultUrl: string | null;
    status: ProcessingStatus;
    error: string | null;

    setOriginal: (image: ImageFile | null) => void;
    setResult: (url: string | null) => void;
    setStatus: (status: ProcessingStatus, error?: string | null) => void;
    reset: () => void;
}

const initialState = {
    original: null,
    resultUrl: null,
    status: "idle",
    error: null,
} satisfies Pick<ImageState, "original" | "resultUrl" | "status" | "error">;

export const useImageStore = create<ImageState>()((set, get) => ({
    ...initialState,

    setOriginal: (image) => {
        const previous = get().original;
        if (previous && previous.previewUrl !== image?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        set({ original: image, resultUrl: null, status: "idle", error: null });
    },
    setResult: (url) => set({ resultUrl: url }),
    setStatus: (status, error = null) => set({ status, error }),
    reset: () => {
        const { original, resultUrl } = get();
        if (original) URL.revokeObjectURL(original.previewUrl);
        if (resultUrl?.startsWith("blob:")) URL.revokeObjectURL(resultUrl);
        set(initialState);
    },
}));
