import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";

export type ScrollMeasure = (rect: DOMRect, viewportHeight: number) => number;

/** Progress through a tall (pinned) element: 0 when its top reaches the viewport top, 1 when its bottom reaches the viewport bottom. */
export const pinnedProgress: ScrollMeasure = (rect, vh) => -rect.top / Math.max(1, rect.height - vh);

/** Progress of an element entering the viewport: 0 as its top crosses `from`, 1 as it crosses `to` (fractions of viewport height). */
export const enterProgress =
    (from = 1, to = 0.2): ScrollMeasure =>
    (rect, vh) =>
        (vh * from - rect.top) / (vh * (from - to));

/**
 * Calls `onProgress` with a 0–1 value whenever scrolling changes it, at most once per frame.
 * Scroll-linked visuals should write styles directly in the callback rather than setting React state.
 */
export function useScrollProgress<T extends Element>(
    ref: RefObject<T | null>,
    measure: ScrollMeasure,
    onProgress: (progress: number) => void,
    enabled = true,
) {
    const callback = useRef(onProgress);
    const measureRef = useRef(measure);
    // Keep the latest callbacks without re-subscribing to scroll events.
    useLayoutEffect(() => {
        callback.current = onProgress;
        measureRef.current = measure;
    });

    useEffect(() => {
        const element = ref.current;
        if (!element || !enabled) return;

        let frame = 0;
        let last = -1;
        const update = () => {
            frame = 0;
            const value = Math.min(1, Math.max(0, measureRef.current(element.getBoundingClientRect(), window.innerHeight)));
            if (Math.abs(value - last) < 0.0005) return;
            last = value;
            callback.current(value);
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };

        update();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [ref, enabled]);
}
