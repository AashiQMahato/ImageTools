import { type Editor, EditorContent } from "@tiptap/react";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import type { OcrDocument } from "@/lib/api/ocrApi";
import { cn } from "@/lib/utils/cn";
import { type EditorMode, pageColours } from "./convert";
import "./ocr.css";

interface OcrPageViewProps {
    editor: Editor;
    result: OcrDocument;
    mode: EditorMode;
    /** The original image, for the overlay (layout mode). */
    imageUrl: string;
    imageSize: { width: number; height: number };
    overlay: number | null;
    showUncertain: boolean;
}

/**
 * The editable page. Document mode is flowing text on a page up to 816px wide (it reflows on narrow
 * screens). Original layout mode is the page at the image's proportions with each block where it
 * was — scaled to fit, still editable — optionally over the original image.
 */
export function OcrPageView({ editor, result, mode, imageUrl, imageSize, overlay, showUncertain }: OcrPageViewProps) {
    const areaRef = useRef<HTMLDivElement>(null);
    const [available, setAvailable] = useState(0);
    const { pageWidth, width, height, region } = result.document;
    const pageHeight = Math.round((pageWidth * height) / width);
    const layout = mode === "layout";

    useLayoutEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        const measure = () => setAvailable(area.clientWidth);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(area);
        return () => observer.disconnect();
    }, []);

    // Layout mode keeps page pixels (so estimated sizes hold) and scales the whole page to fit.
    const scale = layout && available ? Math.min(1.25, (available - 24) / pageWidth) : 1;
    const colours = pageColours(result, mode);
    const page = (
        <div
            className={cn("ocr-page", layout && "ocr-layout", !showUncertain && "ocr-hide-low", layout && overlay !== null && "ocr-with-overlay")}
            style={{ "--page-bg": colours.background, "--page-ink": colours.ink, width: layout ? pageWidth : "100%", maxWidth: pageWidth, height: layout ? pageHeight : undefined, minHeight: layout ? undefined : "100%" } as CSSProperties}
        >
            {layout && overlay !== null && <OverlayImage src={imageUrl} image={imageSize} region={region} opacity={overlay} />}
            <EditorContent editor={editor} className={cn(layout && "h-full")} />
        </div>
    );

    return (
        <div ref={areaRef} className="flex min-h-full w-full justify-center p-3 sm:p-5">
            {layout ? (
                // The frame takes the scaled size, so scrolling and centring follow what you see.
                <div className="relative shrink-0" style={{ width: pageWidth * scale, height: pageHeight * scale }}>
                    <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
                        {page}
                    </div>
                </div>
            ) : (
                page
            )}
        </div>
    );
}

/** The original (or the region that was read) filling the page, behind the text. */
function OverlayImage({ src, image, region, opacity }: { src: string; image: { width: number; height: number }; region: OcrDocument["document"]["region"]; opacity: number }) {
    const box = region ?? { x: 0, y: 0, width: image.width, height: image.height };
    return (
        <div aria-hidden className="ocr-overlay-image" style={{ opacity }}>
            <img
                src={src}
                alt=""
                draggable={false}
                style={{ width: `${(image.width / box.width) * 100}%`, height: `${(image.height / box.height) * 100}%`, left: `${(-box.x / box.width) * 100}%`, top: `${(-box.y / box.height) * 100}%` }}
            />
        </div>
    );
}
