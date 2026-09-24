import { type RefObject, useEffect, useState } from "react";

/** Largest width × height with the given aspect ratio that fits inside `ref`'s content box. Never stretches. */
export function useFitSize(ref: RefObject<HTMLElement | null>, aspect: number | null) {
    const [size, setSize] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element || !aspect) return;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const { width: boxWidth, height: boxHeight } = entry.contentRect;
            if (boxWidth <= 0 || boxHeight <= 0) return;
            const width = Math.min(boxWidth, boxHeight * aspect);
            setSize({ width: Math.floor(width), height: Math.floor(width / aspect) });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref, aspect]);

    return size;
}
