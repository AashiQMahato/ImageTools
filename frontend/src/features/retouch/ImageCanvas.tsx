import { Minus, Plus, Scan } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { type BrushOptions, type RetouchTool, TOOL_ICONS, TOOL_KEYS } from "./modes";
import type { SelectionMask, SelectionStroke } from "./useSelectionMask";

export interface FrameSize {
    width: number;
    height: number;
}

interface ImageCanvasProps {
    src: string;
    alt: string;
    width: number;
    height: number;
    mask: SelectionMask;
    tool: RetouchTool;
    onToolChange: (tool: RetouchTool) => void;
    brush: BrushOptions;
    /** Painting is possible (not while processing, or while a result waits to be kept or discarded). */
    paintable: boolean;
    showMask: boolean;
    /** Something interactive covers the image (the comparison slider): plain drags go to it, not to panning. */
    overlayInteractive?: boolean;
    /** Drawn over the image, sized to it, zooming with it. */
    overlay?: (frame: FrameSize) => ReactNode;
    /** Top centre, over the canvas. */
    top?: ReactNode;
    /** Bottom right, over the canvas: what the image is. */
    info?: ReactNode;
    onStroke: (stroke: SelectionStroke) => void;
}

const MAX_ZOOM = 16;

type Gesture =
    | { type: "pan"; startX: number; startY: number; panX: number; panY: number }
    | { type: "brush" }
    | { type: "pinch"; distance: number; midX: number; midY: number; zoom: number; panX: number; panY: number };

type Point = { x: number; y: number };

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The image, as large as the space allows, with the selection painted over it. Layers are stacked,
 * never flattened — the photo, then the live mask canvas the brush paints into, then any overlay — so
 * painting redraws only the pixels under the brush and the photo itself is never redrawn.
 */
export function ImageCanvas({ src, alt, width, height, mask, tool, onToolChange, brush, paintable, showMask, overlayInteractive = false, overlay, top, info, onStroke }: ImageCanvasProps) {
    const t = useT();
    const copy = t.retouch;
    const areaRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);

    const [area, setArea] = useState({ width: 0, height: 0, pad: 24 });
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    /** Button and keyboard zooms glide; pinch and wheel follow the fingers directly. */
    const [gliding, setGliding] = useState(false);
    const [spaceHeld, setSpaceHeld] = useState(false);

    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<Gesture | null>(null);

    const fit = width && area.width ? Math.min((area.width - area.pad * 2) / width, (area.height - area.pad * 2) / height) : 0;
    const scale = fit * zoom;
    const frame = { width: width * scale, height: height * scale };

    const clampPan = useCallback(
        (x: number, y: number, s: number) => {
            const maxX = Math.max(0, (width * s - (area.width - area.pad * 2)) / 2);
            const maxY = Math.max(0, (height * s - (area.height - area.pad * 2)) / 2);
            return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
        },
        [width, height, area],
    );

    const left = (area.width - frame.width) / 2 + pan.x;
    const topEdge = (area.height - frame.height) / 2 + pan.y;

    /** Zoom so the image point under (ax, ay) — area coordinates — stays under it. */
    const zoomAt = useCallback(
        (next: number, ax = area.width / 2, ay = area.height / 2, glide = false) => {
            const target = Math.min(MAX_ZOOM, Math.max(1, next));
            const docX = (ax - left) / scale;
            const docY = (ay - topEdge) / scale;
            const nextScale = fit * target;
            setGliding(glide);
            setZoom(target);
            setPan(clampPan(ax - docX * nextScale - (area.width - width * nextScale) / 2, ay - docY * nextScale - (area.height - height * nextScale) / 2, nextScale));
        },
        [area, left, topEdge, scale, fit, width, height, clampPan],
    );
    const fitView = useCallback(() => {
        setGliding(true);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    useLayoutEffect(() => {
        const element = areaRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const { width: w, height: h } = entry.contentRect;
            setGliding(false);
            setArea({ width: w, height: h, pad: w < 640 ? 12 : 32 });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Mount the live mask canvas into its layer — the brush paints into it in place, it is never copied.
    // A callback ref, because the layer only exists once the canvas area has been measured.
    const maskCanvas = mask.canvas;
    const maskHost = useCallback(
        (host: HTMLDivElement | null) => {
            if (!host) return;
            host.appendChild(maskCanvas);
            return () => {
                if (maskCanvas.parentElement === host) host.removeChild(maskCanvas);
            };
        },
        [maskCanvas],
    );

    // Wheel: pinch-zoom on trackpads (ctrl + wheel) and ⌘/Ctrl + wheel zoom; plain wheel pans when zoomed.
    useEffect(() => {
        const element = areaRef.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => {
            const rect = element.getBoundingClientRect();
            if (event.ctrlKey || event.metaKey) {
                event.preventDefault();
                zoomAt(zoom * Math.exp(-event.deltaY * 0.01), event.clientX - rect.left, event.clientY - rect.top);
            } else if (zoom > 1) {
                event.preventDefault();
                setGliding(false);
                setPan((current) => clampPan(current.x - event.deltaX, current.y - event.deltaY, scale));
            }
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, [zoom, zoomAt, clampPan, scale]);

    // Keyboard: + / − / 0 for zoom, and space held to pan with any tool.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === " " && (event.target === document.body || areaRef.current?.contains(event.target as Node))) {
                event.preventDefault();
                setSpaceHeld(true);
            } else if (event.key === "+" || event.key === "=") zoomAt(zoom * 1.5, undefined, undefined, true);
            else if (event.key === "-" || event.key === "_") zoomAt(zoom / 1.5, undefined, undefined, true);
            else if (event.key === "0") fitView();
        };
        const onKeyUp = (event: KeyboardEvent) => {
            if (event.key === " ") setSpaceHeld(false);
        };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, [zoom, zoomAt, fitView]);

    // ---------------------------------------------------------------- pointer input

    const toArea = (event: { clientX: number; clientY: number }): Point => {
        const rect = areaRef.current!.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    /** Area coordinates → image pixels. */
    const toImage = (point: Point): Point => ({ x: (point.x - left) / scale, y: (point.y - topEdge) / scale });

    const painting = paintable && (tool === "paint" || tool === "erase") && !spaceHeld;

    const moveCursor = (point: Point, visible: boolean) => {
        const cursor = cursorRef.current;
        if (!cursor) return;
        const diameter = brush.size * scale;
        cursor.style.opacity = visible ? "1" : "0";
        cursor.style.width = cursor.style.height = `${diameter}px`;
        cursor.style.transform = `translate(${point.x - diameter / 2}px, ${point.y - diameter / 2}px)`;
    };

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!scale) return;
        const point = toArea(event);
        pointers.current.set(event.pointerId, point);

        if (pointers.current.size === 2) {
            // A second finger turns any gesture into pinch-zoom; an unfinished stroke is dropped.
            if (gesture.current?.type === "brush") mask.cancelStroke();
            const [a, b] = [...pointers.current.values()] as [Point, Point];
            gesture.current = { type: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, zoom, panX: pan.x, panY: pan.y };
            setGliding(false);
            moveCursor(point, false);
            return;
        }
        if (pointers.current.size > 2) return;

        const panRequested = spaceHeld || event.button === 1 || (tool === "move" && !overlayInteractive);
        // Over the comparison slider, a plain drag belongs to the slider.
        if (overlayInteractive && !panRequested) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        if (!panRequested && painting && event.button === 0) {
            const { x, y } = toImage(point);
            mask.beginStroke({ mode: tool === "erase" ? "erase" : "paint", size: brush.size, softness: brush.softness, opacity: brush.opacity }, x, y);
            gesture.current = { type: "brush" };
            return;
        }
        if (panRequested || zoom > 1) {
            gesture.current = { type: "pan", startX: point.x, startY: point.y, panX: pan.x, panY: pan.y };
            setGliding(false);
        }
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const point = toArea(event);
        if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, point);
        const current = gesture.current;
        moveCursor(point, painting && event.pointerType !== "touch" && current?.type !== "pinch");

        if (!current) {
            event.currentTarget.style.cursor = spaceHeld || (tool === "move" && !overlayInteractive) ? "grab" : painting ? "none" : zoom > 1 && !overlayInteractive ? "grab" : "";
            return;
        }
        if (current.type === "brush") {
            // Every sample the pointer took since the last frame, so fast strokes stay smooth curves.
            const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
            for (const sample of samples.length ? samples : [event.nativeEvent]) {
                const { x, y } = toImage(toArea(sample));
                mask.extendStroke(x, y);
            }
        } else if (current.type === "pan") {
            setPan(clampPan(current.panX + point.x - current.startX, current.panY + point.y - current.startY, scale));
            event.currentTarget.style.cursor = "grabbing";
        } else if (current.type === "pinch" && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()] as [Point, Point];
            const distance = Math.hypot(a.x - b.x, a.y - b.y);
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const nextZoom = Math.min(MAX_ZOOM, Math.max(1, current.zoom * (distance / Math.max(1, current.distance))));
            const startScale = fit * current.zoom;
            const nextScale = fit * nextZoom;
            // Keep the image point that was under the fingers' midpoint under the new midpoint.
            const startLeft = (area.width - width * startScale) / 2 + current.panX;
            const startTop = (area.height - height * startScale) / 2 + current.panY;
            const docX = (current.midX - startLeft) / startScale;
            const docY = (current.midY - startTop) / startScale;
            setZoom(nextZoom);
            setPan(clampPan(midX - docX * nextScale - (area.width - width * nextScale) / 2, midY - docY * nextScale - (area.height - height * nextScale) / 2, nextScale));
        }
    };

    const endPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
        pointers.current.delete(event.pointerId);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        const current = gesture.current;
        if (current?.type === "pinch") {
            if (pointers.current.size < 2) gesture.current = null;
            return;
        }
        gesture.current = null;
        if (current?.type === "brush") {
            if (cancelled) mask.cancelStroke();
            else {
                const stroke = mask.endStroke();
                if (stroke) onStroke(stroke);
            }
        }
        if (current?.type === "pan") event.currentTarget.style.cursor = "";
        if (event.pointerType === "touch") moveCursor({ x: 0, y: 0 }, false);
    };

    const percent = Math.round(scale * 100);
    const glass = "material pointer-events-auto flex items-center gap-0.5 rounded-xl p-1";
    const iconButton =
        "grid size-9 cursor-pointer place-items-center rounded-lg text-secondary transition-colors duration-150 outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-11";
    const tools: { id: RetouchTool; label: string }[] = [
        { id: "paint", label: copy.paintTool },
        { id: "erase", label: copy.eraseTool },
        { id: "move", label: copy.moveTool },
    ];

    return (
        <div className="relative flex min-h-0 flex-1 flex-col">
            <div
                ref={areaRef}
                className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endPointer(event)}
                onPointerCancel={(event) => endPointer(event, true)}
                onPointerLeave={() => moveCursor({ x: 0, y: 0 }, false)}
                onDoubleClick={(event) => {
                    if (painting || overlayInteractive) return;
                    const point = toArea(event);
                    if (zoom > 1) fitView();
                    else zoomAt(2.5, point.x, point.y, true);
                }}
            >
                {scale > 0 && (
                    <div
                        role="group"
                        aria-label={copy.canvasLabel}
                        className={cn("absolute overflow-hidden rounded-sm", gliding && "transition-[left,top,width,height] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none")}
                        style={{ left, top: topEdge, width: frame.width, height: frame.height }}
                        onTransitionEnd={() => setGliding(false)}
                    >
                        {/* Image layer: the current photo. Keyed, so a kept result fades in rather than snapping. */}
                        <img key={src} src={src} alt={alt} draggable={false} className="retouch-fade-in absolute inset-0 size-full" />
                        {/* Mask layer: the live selection canvas, mounted here. */}
                        <div ref={maskHost} aria-hidden className="retouch-mask absolute inset-0" data-hidden={showMask ? undefined : ""} />
                        {overlay && <div className="absolute inset-0">{overlay(frame)}</div>}
                    </div>
                )}

                {/* Brush cursor: the exact size the stroke will be, with its hard core marked. */}
                <div
                    ref={cursorRef}
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute top-0 left-0 grid place-items-center rounded-full border-[1.5px] border-white opacity-0 shadow-[0_0_0_1px_rgb(0_0_0/0.45),inset_0_0_0_1px_rgb(0_0_0/0.25)] transition-opacity duration-150",
                        tool === "erase" ? "bg-white/10" : "bg-violet-500/15",
                    )}
                >
                    <span className="rounded-full border border-dashed border-white/80" style={{ width: `${Math.max(8, (1 - brush.softness) * 100)}%`, height: `${Math.max(8, (1 - brush.softness) * 100)}%` }} />
                </div>
            </div>

            {/* Compact tools, top left (desktop — phones get the bottom toolbar). */}
            <div className="pointer-events-none absolute top-3 left-3 hidden lg:block">
                <div role="toolbar" aria-label={copy.tools} aria-orientation="vertical" className={cn(glass, "flex-col")}>
                    {tools.map(({ id, label }) => {
                        const Icon = TOOL_ICONS[id];
                        const selected = tool === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => onToolChange(id)}
                                aria-pressed={selected}
                                aria-label={label}
                                title={`${label} (${TOOL_KEYS[id]})`}
                                disabled={!paintable && id !== "move"}
                                className={cn(iconButton, selected && "bg-[var(--brand-soft)] text-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]")}
                            >
                                <Icon className="size-4" aria-hidden />
                            </button>
                        );
                    })}
                </div>
            </div>

            {top && <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center [&>*]:pointer-events-auto">{top}</div>}

            {/* Zoom, bottom left; what the image is, bottom right. */}
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
                <div className={glass}>
                    <button type="button" className={iconButton} onClick={() => zoomAt(zoom / 1.5, undefined, undefined, true)} disabled={zoom <= 1} aria-label={copy.zoomOut} title={`${copy.zoomOut} (−)`}>
                        <Minus className="size-4" aria-hidden />
                    </button>
                    <span className="min-w-12 text-center text-xs font-semibold text-secondary tabular-nums" aria-live="polite" aria-label={copy.zoomLevel(percent)}>
                        {percent}%
                    </span>
                    <button type="button" className={iconButton} onClick={() => zoomAt(zoom * 1.5, undefined, undefined, true)} disabled={zoom >= MAX_ZOOM} aria-label={copy.zoomIn} title={`${copy.zoomIn} (+)`}>
                        <Plus className="size-4" aria-hidden />
                    </button>
                    <span aria-hidden className="mx-0.5 h-5 w-px bg-[var(--card-line)]" />
                    <button type="button" className={cn(iconButton, "w-auto gap-1.5 px-2.5 text-xs font-semibold")} onClick={fitView} disabled={zoom === 1 && pan.x === 0 && pan.y === 0} title={`${copy.fit} (0)`}>
                        <span className="flex items-center gap-1.5">
                            <Scan className="size-3.5" aria-hidden />
                            {copy.fit}
                        </span>
                    </button>
                </div>
                {info && <div className="material pointer-events-auto hidden rounded-xl px-3 py-2 text-xs text-secondary tabular-nums sm:block">{info}</div>}
            </div>
        </div>
    );
}
