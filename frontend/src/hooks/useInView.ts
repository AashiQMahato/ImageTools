import { useEffect, useRef, useState } from "react";

interface InViewOptions {
    /** Stop observing after the first time the element enters the viewport. */
    once?: boolean;
    rootMargin?: string;
    threshold?: number;
}

/** Tracks whether an element is in the viewport. Pair with the `reveal` utility via `data-inview`. */
export function useInView<T extends Element>({ once = true, rootMargin = "0px 0px -12% 0px", threshold = 0 }: InViewOptions = {}) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!entry) return;
                setInView(entry.isIntersecting);
                if (entry.isIntersecting && once) observer.disconnect();
            },
            { rootMargin, threshold },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, [once, rootMargin, threshold]);

    return [ref, inView] as const;
}
