import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A scrolling column of pages: which page is current (the one across the upper third of the view),
 * going to a page, and — when zooming or turning changes every page's size — staying on the same
 * spot of the same page rather than jumping.
 */
export function usePageScroller(element: HTMLElement | null, count: number) {
    const pages = useRef(new Map<number, HTMLElement>());
    const [current, setCurrent] = useState(1);
    // Where the view is: a page, and how far down it (0–1).
    const anchor = useRef({ page: 1, fraction: 0 });

    const locate = useCallback(() => {
        if (!element) return;
        const line = element.scrollTop + element.clientHeight / 3;
        let found = 1;
        for (let page = 1; page <= count; page++) {
            const node = pages.current.get(page);
            if (!node) continue;
            if (node.offsetTop <= line) found = page;
            else break;
        }
        // At the very end, the last page is the one being read, even if it's too short to reach the line.
        if (element.scrollTop > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 2) found = count;
        const node = pages.current.get(found);
        anchor.current = { page: found, fraction: node ? Math.min(1, Math.max(0, (element.scrollTop - node.offsetTop) / Math.max(1, node.offsetHeight))) : 0 };
        setCurrent(found);
    }, [element, count]);

    useEffect(() => {
        if (!element) return;
        let frame = 0;
        const onScroll = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(locate);
        };
        element.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            element.removeEventListener("scroll", onScroll);
            cancelAnimationFrame(frame);
        };
    }, [element, locate]);

    /** After every page changes size (zoom, turn): back to the same place. Call from a layout effect. */
    const restore = useCallback(() => {
        const node = pages.current.get(anchor.current.page);
        if (!element || !node) return;
        element.scrollTo({ top: node.offsetTop + anchor.current.fraction * node.offsetHeight });
    }, [element]);

    const goTo = useCallback(
        (page: number, behavior: ScrollBehavior = "auto") => {
            const node = pages.current.get(Math.min(count, Math.max(1, page)));
            if (!element || !node) return;
            element.scrollTo({ top: node.offsetTop - 16, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : behavior });
            setCurrent(Math.min(count, Math.max(1, page)));
        },
        [element, count],
    );

    const register = useCallback((page: number, node: HTMLElement | null) => {
        if (node) pages.current.set(page, node);
        else pages.current.delete(page);
    }, []);

    return { current, goTo, register, restore };
}
