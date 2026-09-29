import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { type CSSProperties, type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { pdfjs } from "@/lib/pdf/pdfjs";
import { cn } from "@/lib/utils/cn";
import "./pdfCanvas.css";

/** A page's text layer, once built: the text runs (one element per pdf.js text item) and their strings. */
export interface PageText {
    container: HTMLElement;
    divs: HTMLElement[];
    items: string[];
}

interface PdfPageProps {
    document: PDFDocumentProxy;
    /** 1-based. */
    page: number;
    /** The page as displayed (points, its own rotation applied). */
    size: { width: number; height: number };
    /** CSS pixels per point. */
    scale: number;
    /** An extra clockwise turn for viewing (the file isn't changed). */
    rotation?: 0 | 90 | 180 | 270;
    /** Build the selectable, searchable text layer. */
    textLayer?: boolean;
    /** Text layer takes the pointer (selecting text) — otherwise clicks go to what's above or below. */
    textInteractive?: boolean;
    onText?: (page: number, text: PageText | null) => void;
    label: string;
    className?: string;
    style?: CSSProperties;
    ref?: Ref<HTMLDivElement>;
    /** Drawn over the page (annotations, search matches), in CSS pixels. */
    children?: ReactNode;
}

/** The most pixels one page's canvas may have (browsers cap canvas area; memory adds up fast). */
const MAX_PIXELS = 16_000_000;

/**
 * One page of a PDF at any zoom: drawn only while near the view (and dropped when far away, so long
 * documents stay light), sharp at the screen's pixel density, redrawn a moment after zooming stops
 * (the old drawing stretched meanwhile). Optionally with pdf.js's text layer over it, for selecting
 * and finding text.
 */
export function PdfPage({ document, page, size, scale, rotation = 0, textLayer = false, textInteractive = true, onText, label, className, style, ref, children }: PdfPageProps) {
    const holder = useRef<HTMLDivElement | null>(null);
    const canvasHolder = useRef<HTMLDivElement>(null);
    const textHolder = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const [drawn, setDrawn] = useState(false);
    const [renderScale, setRenderScale] = useState(scale);
    const onTextRef = useRef(onText);
    useEffect(() => {
        onTextRef.current = onText;
    }, [onText]);

    useEffect(() => {
        const element = holder.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) => setNear(Boolean(entry?.isIntersecting)), { rootMargin: "1200px 600px" });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Zooming redraws once it settles; until then the current drawing is stretched to fit.
    useEffect(() => {
        if (scale === renderScale) return;
        const timer = window.setTimeout(() => setRenderScale(scale), 140);
        return () => window.clearTimeout(timer);
    }, [scale, renderScale]);

    useEffect(() => {
        const target = canvasHolder.current;
        if (!target) return;
        if (!near) {
            // Far from view: free the pixels.
            target.replaceChildren();
            return;
        }
        let task: RenderTask | null = null;
        let cancelled = false;
        void (async () => {
            const pdfPage = await document.getPage(page);
            if (cancelled) return;
            const base = pdfPage.getViewport({ scale: 1, rotation: (pdfPage.rotate + rotation) % 360 });
            const wanted = renderScale * Math.min(3, window.devicePixelRatio || 1);
            const pixels = Math.min(wanted, Math.sqrt(MAX_PIXELS / (base.width * base.height)));
            const viewport = pdfPage.getViewport({ scale: pixels, rotation: (pdfPage.rotate + rotation) % 360 });
            // Drawn off-screen, then swapped in: never a blank page while redrawing.
            const canvas = window.document.createElement("canvas");
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            canvas.className = "pdf-page-canvas";
            task = pdfPage.render({ canvas, viewport, background: "#ffffff" });
            try {
                await task.promise;
            } catch {
                return;
            }
            if (cancelled) return;
            target.replaceChildren(canvas);
            setDrawn(true);
        })();
        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [document, page, renderScale, rotation, near]);

    useEffect(() => {
        const container = textHolder.current;
        if (!textLayer || !near || !container) return;
        let cancelled = false;
        let layer: { cancel: () => void } | null = null;
        void (async () => {
            const [library, pdfPage] = await Promise.all([pdfjs(), document.getPage(page)]);
            if (cancelled) return;
            container.replaceChildren();
            const text = new library.TextLayer({ textContentSource: pdfPage.streamTextContent(), container, viewport: pdfPage.getViewport({ scale: 1, rotation: (pdfPage.rotate + rotation) % 360 }) });
            layer = text;
            try {
                await text.render();
            } catch {
                return;
            }
            if (cancelled) return;
            onTextRef.current?.(page, { container, divs: text.textDivs, items: text.textContentItemsStr });
        })();
        return () => {
            cancelled = true;
            layer?.cancel();
            container.replaceChildren();
            onTextRef.current?.(page, null);
        };
    }, [document, page, rotation, textLayer, near]);

    const sideways = rotation % 180 !== 0;
    const width = (sideways ? size.height : size.width) * scale;
    const height = (sideways ? size.width : size.height) * scale;
    return (
        <div
            ref={(element) => {
                holder.current = element;
                if (typeof ref === "function") ref(element);
                else if (ref) ref.current = element;
            }}
            role="group"
            aria-roledescription="page"
            aria-label={label}
            data-page={page}
            className={cn("pdf-page relative shrink-0 bg-white", className)}
            style={{ width, height, "--total-scale-factor": scale, ...style } as CSSProperties}
        >
            <div ref={canvasHolder} aria-hidden className="absolute inset-0" />
            {!(drawn && near) && <span aria-hidden className="absolute inset-[4%] animate-pulse rounded-sm bg-black/[0.04] motion-reduce:animate-none" />}
            {textLayer && <div ref={textHolder} className={cn("textLayer", !textInteractive && "pointer-events-none")} />}
            {children}
        </div>
    );
}
