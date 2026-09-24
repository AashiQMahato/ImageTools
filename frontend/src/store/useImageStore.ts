import { create } from "zustand";
import { clearDraftImage, loadDraftImage, saveDraftImage } from "@/lib/draft";
import type { ImageFile, UpscaleFactor } from "@/types/image";

/**
 * State shared across pages: the image the user is working on (it follows them from the landing page
 * into any tool, and survives a reload as a local draft) and their preferred upscale factor.
 * Per-run processing state stays local to each tool.
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
        if (image) void saveDraftImage({ id: image.id, file: image.file, width: image.dimensions.width, height: image.dimensions.height });
        else void clearDraftImage();
    },
    setSelectedScale: (selectedScale) => set({ selectedScale }),
    clear: () => get().setOriginal(null),
}));

/** Bring back the image from the last visit, before the first render so pages open with it in place. */
export async function restoreDraftImage() {
    const draft = await loadDraftImage();
    if (!draft || useImageStore.getState().original) return;
    const file = draft.file instanceof File ? draft.file : new File([draft.file], "image", { type: (draft.file as Blob).type });
    useImageStore.setState({
        original: {
            id: draft.id,
            file,
            name: file.name,
            size: file.size,
            mimeType: file.type,
            previewUrl: URL.createObjectURL(file),
            dimensions: { width: draft.width, height: draft.height },
        },
    });
}
