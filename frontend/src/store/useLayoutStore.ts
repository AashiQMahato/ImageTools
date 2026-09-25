import { useEffect } from "react";
import { create } from "zustand";

/**
 * Whether a full-screen workspace (the background studio) owns the viewport. The marketing navbar
 * and footer step aside while it does, so the canvas gets the whole screen.
 */
export const useLayoutStore = create<{ immersive: boolean; setImmersive: (immersive: boolean) => void }>()((set) => ({
    immersive: false,
    setImmersive: (immersive) => set({ immersive }),
}));

/** Claims the viewport for as long as the calling component is mounted. */
export function useImmersiveLayout() {
    const setImmersive = useLayoutStore((state) => state.setImmersive);
    useEffect(() => {
        setImmersive(true);
        return () => setImmersive(false);
    }, [setImmersive]);
}
