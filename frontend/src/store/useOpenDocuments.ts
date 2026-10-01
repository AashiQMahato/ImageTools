import { create } from "zustand";

/**
 * The PDFs open in the current document tool — so moving to another mode of the same feature (merge →
 * compress) can carry them along instead of starting empty. In memory only.
 */
export const useOpenDocuments = create<{ files: readonly File[]; set: (files: readonly File[]) => void }>()((set) => ({
    files: [],
    set: (files) => set({ files }),
}));
