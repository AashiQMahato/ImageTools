import { create } from "zustand";
import type { ToolKey } from "@/lib/constants/navigation";

interface Handoff {
    files: File[];
    from: ToolKey;
}

interface HandoffState {
    pending: Handoff | null;
    /** Files for the next tool to open (a result carried on: merged → compressed → signed…). */
    send: (files: File[], from: ToolKey) => void;
    /** The files waiting, once: taking them clears them. */
    take: () => Handoff | null;
}

/**
 * Moving a result from one tool to the next without downloading and uploading it again. Held in
 * memory only — never stored — and taken by the first tool that opens.
 */
export const useHandoff = create<HandoffState>()((set, get) => ({
    pending: null,
    send: (files, from) => set({ pending: { files, from } }),
    take: () => {
        const pending = get().pending;
        if (pending) set({ pending: null });
        return pending;
    },
}));
