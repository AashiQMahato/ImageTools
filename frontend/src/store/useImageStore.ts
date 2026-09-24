import { create } from "zustand";
import type { ImageFile, UpscaleFactor } from "@/types/image";

/**
 * State shared across pages: the image the user is working on (it follows them from the landing page
 * into any tool) and their preferred upscale factor. Per-run processing state stays local to each tool.
 */
interface ImageState {
    original: ImageFile | null;
    selectedScale: UpscaleFactor;

    setOriginal: (image: ImageFile | null) => void;
    setSelectedScale: (scale: UpscaleFactor) => void;
    clear: () => void;
}

export const useImageStore = create<ImageState>()((set, get) => ({
    original: null,
    selectedScale: 2,

    setOriginal: (image) => {
        const previous = get().original;
        if (previous && previous.previewUrl !== image?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
        set({ original: image });
    },
    setSelectedScale: (selectedScale) => set({ selectedScale }),
    clear: () => get().setOriginal(null),
}));
