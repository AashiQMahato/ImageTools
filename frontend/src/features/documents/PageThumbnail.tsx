import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface PageThumbnailProps {
    document: PDFDocumentProxy;
    /** 1-based. */
    page: number;
    /** Extra clockwise turn, shown without re-rendering. */
    rotate?: number;
    /** The page's size as displayed (points), for the box before it's drawn. */
    size: { width: number; height: number };
    /** Drawing width in CSS pixels. */
    width: number;
    className?: string;
    label: string;
}

/**
 * One page, drawn only when it scrolls near the view (long documents never render every page at
 * once) and at the screen's pixel density. Turning it is a CSS transform — no re-render.
 */
export function PageThumbnail({ document, page, rotate = 0, size, width, className, label }: PageThumbnailProps) {
    const holder = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const [visible, setVisible] = useState(false);
    const [drawn, setDrawn] = useState(false);

    useEffect(() => {
        const element = holder.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setVisible(true), { rootMargin: "400px" });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!visible || !canvas.current) return;
        let task: RenderTask | null = null;
        let cancelled = false;
        void (async () => {
            const pdfPage = await document.getPage(page);
            if (cancelled || !canvas.current) return;
            const ratio = Math.min(2, window.devicePixelRatio || 1);
            const viewport = pdfPage.getViewport({ scale: (width * ratio) / pdfPage.getViewport({ scale: 1 }).width });
            canvas.current.width = Math.round(viewport.width);
            canvas.current.height = Math.round(viewport.height);
            task = pdfPage.render({ canvas: canvas.current, viewport, background: "#ffffff" });
            await task.promise.then(() => !cancelled && setDrawn(true)).catch(() => undefined);
        })();
        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [visible, document, page, width]);

    const sideways = rotate % 180 !== 0;
    const aspect = sideways ? size.height / size.width : size.width / size.height;
    return (
        <div ref={holder} role="img" aria-label={label} className={cn("relative w-full overflow-hidden", className)} style={{ aspectRatio: `${Math.max(aspect, 0.4)} / 1` }}>
            {/* Turned a quarter, the page's width becomes the box's height: sized so it still fills the box. */}
            <canvas
                ref={canvas}
                className={cn("absolute top-1/2 left-1/2 bg-white shadow-[0_1px_3px_rgb(0_0_0/0.18)] transition-[transform,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none", drawn ? "opacity-100" : "opacity-0")}
                style={{ width: sideways ? `${(100 * size.width) / size.height}%` : "100%", transform: `translate(-50%, -50%) rotate(${rotate}deg)` }}
            />
            {!drawn && <span aria-hidden className="absolute inset-[6%] animate-pulse rounded-sm bg-[var(--card-line)] motion-reduce:animate-none" />}
        </div>
    );
}
