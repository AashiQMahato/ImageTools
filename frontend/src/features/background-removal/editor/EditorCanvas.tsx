import { Brush, ChevronDown, Hand, Maximize, Minimize, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { drawBackground } from "./backgrounds";
import type { BrushMode, EditorDoc, Placement, Stroke } from "./document";
import type { MaskEngine } from "./useMaskEngine";

export type CanvasTool = "move" | "brush";
export type CanvasView = "before" | "after";

export interface BrushSettings {
    mode: BrushMode;
    size: number;
    softness: number;
    opacity: number;
}

interface EditorCanvasProps {
    engine: MaskEngine;
    doc: EditorDoc;
    /** Decoded photo for an image background, or null while it loads / when there isn't one. */
    photo: ImageBitmap | null;
    tool: CanvasTool;
    brush: BrushSettings;
    onToolChange: (tool: CanvasTool) => void;
    view: CanvasView;
    onPlacementPreview: (placement: Placement) => void;
    onPlacementSettle: () => void;
    onStroke: (stroke: Stroke) => void;
}

/** Largest preview surface for backgrounds; exports are always drawn at full size separately. */
const PREVIEW_MAX = 4096;
const MAX_ZOOM = 12;
/** Screen pixels within which a dragged subject snaps to the centre lines. */
const SNAP_PX = 8;

type Gesture =
    | { type: "pan"; startX: number; startY: number; panX: number; panY: number }
    | { type: "move"; startX: number; startY: number; placement: Placement }
    | { type: "brush" }
    | { type: "pinch"; distance: number; midX: number; midY: number; zoom: number; panX: number; panY: number };

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The canvas: the composition at its real aspect ratio, as large as the space allows. Layers are
 * stacked rather than flattened — background, then the live subject canvas the mask engine paints
 * into — so moving the subject or painting the mask never redraws the whole image.
 */
export function EditorCanvas({ engine, doc, photo, tool, onToolChange, brush, view, onPlacementPreview, onPlacementSettle, onStroke }: EditorCanvasProps) {
    const t = useT();
    const copy = t.bgEditor;
    const rootRef = useRef<HTMLDivElement>(null);
    const areaRef = useRef<HTMLDivElement>(null);
    const subjectHost = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<HTMLCanvasElement>(null);
    const beforeRef = useRef<HTMLCanvasElement>(null);
    const ringRef = useRef<HTMLDivElement>(null);

    const [area, setArea] = useState({ width: 0, height: 0, padding: 24 });
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [snap, setSnap] = useState({ x: false, y: false });
    const [moving, setMoving] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [zoomMenu, setZoomMenu] = useState(false);

    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const gesture = useRef<Gesture | null>(null);

    const { width, height } = engine;
    const fit = width && area.width ? Math.min((area.width - area.padding * 2) / width, (area.height - area.padding * 2) / height) : 0;
    const scale = fit * zoom;
    const frameWidth = width * scale;
    const frameHeight = height * scale;

    const clampPan = useCallback(
        (x: number, y: number, s: number) => {
            const maxX = Math.max(0, (width * s - (area.width - area.padding * 2)) / 2);
            const maxY = Math.max(0, (height * s - (area.height - area.padding * 2)) / 2);
            return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
        },
        [width, height, area],
    );

    const left = (area.width - frameWidth) / 2 + pan.x;
    const top = (area.height - frameHeight) / 2 + pan.y;

    /** Zoom so the image point under (ax, ay) — area coordinates — stays under it. */
    const zoomAt = useCallback(
        (next: number, ax = area.width / 2, ay = area.height / 2) => {
            const target = Math.min(MAX_ZOOM, Math.max(1, next));
            const docX = (ax - left) / scale;
            const docY = (ay - top) / scale;
            const nextScale = fit * target;
            const nextLeft = ax - docX * nextScale;
            const nextTop = ay - docY * nextScale;
            setZoom(target);
            setPan(clampPan(nextLeft - (area.width - width * nextScale) / 2, nextTop - (area.height - height * nextScale) / 2, nextScale));
        },
        [area, left, top, scale, fit, width, height, clampPan],
    );
    const fitView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    // Measure the space the image may fill.
    useLayoutEffect(() => {
        const element = areaRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (!entry) return;
            const { width: w, height: h } = entry.contentRect;
            setArea({ width: w, height: h, padding: w < 640 ? 12 : 64 });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Mount the engine's live subject canvas once — it's painted in place, never copied.
    useEffect(() => {
        const host = subjectHost.current;
        const subject = engine.ready ? engine.subject() : null;
        if (!host || !subject) return;
        subject.className = "block size-full";
        subject.setAttribute("aria-label", copy.subjectAlt);
        host.appendChild(subject);
        return () => {
            if (subject.parentElement === host) host.removeChild(subject);
        };
    }, [engine, engine.ready, copy.subjectAlt]);

    // Background layer, redrawn only when the background itself changes.
    useEffect(() => {
        const element = backgroundRef.current;
        if (!element || !width) return;
        const k = Math.min(1, PREVIEW_MAX / Math.max(width, height));
        element.width = Math.round(width * k);
        element.height = Math.round(height * k);
        const ctx = element.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, element.width, element.height);
        drawBackground(ctx, doc.background, element.width, element.height, photo);
    }, [doc.background, photo, width, height]);

    // The original photo, for Before.
    useEffect(() => {
        const element = beforeRef.current;
        const source = engine.ready ? engine.sourceBitmap() : null;
        if (!element || !source || view !== "before") return;
        const k = Math.min(1, PREVIEW_MAX / Math.max(source.width, source.height));
        element.width = Math.round(source.width * k);
        element.height = Math.round(source.height * k);
        element.getContext("2d")?.drawImage(source, 0, 0, element.width, element.height);
    }, [engine, engine.ready, view]);

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
                setPan((current) => clampPan(current.x - event.deltaX, current.y - event.deltaY, scale));
            }
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, [zoom, zoomAt, clampPan, scale]);

    // Keyboard: + / − / 0 for zoom, and space held to pan with any tool.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setZoomMenu(false);
            if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.key === " " && (event.target === document.body || areaRef.current?.contains(event.target as Node))) {
                event.preventDefault();
                setSpaceHeld(true);
            } else if (event.key === "+" || event.key === "=") zoomAt(zoom * 1.5);
            else if (event.key === "-" || event.key === "_") zoomAt(zoom / 1.5);
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

    useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);
    const toggleFullscreen = () => {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
    };

    // ---------------------------------------------------------------- pointer input

    const { placement } = doc;
    const subjectRect = {
        x: (width - width * placement.scale) / 2 + placement.x,
        y: (height - height * placement.scale) / 2 + placement.y,
        width: width * placement.scale,
        height: height * placement.scale,
    };

    const toArea = (event: { clientX: number; clientY: number }) => {
        const rect = areaRef.current!.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    /** Area coordinates → image pixels, undoing the subject's own placement (the mask lives in its space). */
    const toSubject = (x: number, y: number) => ({
        x: ((x - left) / scale - subjectRect.x) / placement.scale,
        y: ((y - top) / scale - subjectRect.y) / placement.scale,
    });
    const overSubject = (x: number, y: number) => {
        const docX = (x - left) / scale;
        const docY = (y - top) / scale;
        return docX >= subjectRect.x && docX <= subjectRect.x + subjectRect.width && docY >= subjectRect.y && docY <= subjectRect.y + subjectRect.height;
    };

    const showRing = (x: number, y: number, visible: boolean) => {
        const ring = ringRef.current;
        if (!ring) return;
        const diameter = brush.size * scale * placement.scale;
        ring.style.opacity = visible ? "1" : "0";
        ring.style.width = ring.style.height = `${diameter}px`;
        ring.style.transform = `translate(${x - diameter / 2}px, ${y - diameter / 2}px)`;
    };

    const painting = tool === "brush" && view === "after";

    const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!engine.ready || !scale) return;
        const point = toArea(event);
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, point);

        if (pointers.current.size === 2) {
            // A second finger turns any gesture into pinch-zoom; an unfinished stroke is dropped.
            if (gesture.current?.type === "brush") engine.cancelStroke();
            if (gesture.current?.type === "move") onPlacementSettle();
            const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
            gesture.current = { type: "pinch", distance: Math.hypot(a.x - b.x, a.y - b.y), midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, zoom, panX: pan.x, panY: pan.y };
            setMoving(false);
            showRing(0, 0, false);
            return;
        }
        if (pointers.current.size > 2) return;

        const panRequested = spaceHeld || event.button === 1;
        if (!panRequested && painting && event.button === 0) {
            const { x, y } = toSubject(point.x, point.y);
            engine.beginStroke({ mode: brush.mode, size: brush.size, softness: brush.softness, opacity: brush.opacity }, x, y);
            gesture.current = { type: "brush" };
            return;
        }
        if (!panRequested && tool === "move" && view === "after" && event.button === 0 && overSubject(point.x, point.y)) {
            gesture.current = { type: "move", startX: point.x, startY: point.y, placement };
            setMoving(true);
            return;
        }
        if (zoom > 1 || panRequested) gesture.current = { type: "pan", startX: point.x, startY: point.y, panX: pan.x, panY: pan.y };
    };

    const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        const point = toArea(event);
        if (pointers.current.has(event.pointerId)) pointers.current.set(event.pointerId, point);
        const current = gesture.current;

        if (painting && event.pointerType !== "touch" && !spaceHeld) showRing(point.x, point.y, true);
        else showRing(point.x, point.y, false);

        if (!current) {
            const element = event.currentTarget;
            element.style.cursor = spaceHeld ? "grab" : painting ? "none" : tool === "move" && view === "after" && overSubject(point.x, point.y) ? "move" : zoom > 1 ? "grab" : "default";
            return;
        }
        if (current.type === "brush") {
            const { x, y } = toSubject(point.x, point.y);
            engine.extendStroke(x, y);
        } else if (current.type === "move") {
            let x = current.placement.x + (point.x - current.startX) / scale;
            let y = current.placement.y + (point.y - current.startY) / scale;
            const snapX = Math.abs(x * scale) < SNAP_PX;
            const snapY = Math.abs(y * scale) < SNAP_PX;
            if (snapX) x = 0;
            if (snapY) y = 0;
            setSnap((previous) => (previous.x === snapX && previous.y === snapY ? previous : { x: snapX, y: snapY }));
            onPlacementPreview({ ...current.placement, x, y });
        } else if (current.type === "pan") {
            setPan(clampPan(current.panX + point.x - current.startX, current.panY + point.y - current.startY, scale));
            event.currentTarget.style.cursor = "grabbing";
        } else if (current.type === "pinch" && pointers.current.size >= 2) {
            const [a, b] = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
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
            if (cancelled) engine.cancelStroke();
            else {
                const stroke = engine.endStroke();
                if (stroke) onStroke(stroke);
            }
        } else if (current?.type === "move") {
            setMoving(false);
            setSnap({ x: false, y: false });
            onPlacementSettle();
        }
        if (event.pointerType === "touch") showRing(0, 0, false);
    };

    const transparent = doc.background.kind === "transparent";
    const percent = Math.round(scale * 100);
    const toolButton =
        "grid size-9 cursor-pointer place-items-center rounded-lg text-secondary transition-colors duration-150 outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-11";

    return (
        <div ref={rootRef} className={cn("relative flex min-h-0 flex-1 flex-col", fullscreen && "bg-secondary")}>
            <div
                ref={areaRef}
                className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={(event) => endPointer(event)}
                onPointerCancel={(event) => endPointer(event, true)}
                onPointerLeave={() => showRing(0, 0, false)}
                onDoubleClick={(event) => {
                    if (painting) return;
                    const point = toArea(event);
                    if (zoom > 1) fitView();
                    else zoomAt(2.5, point.x, point.y);
                }}
            >
                {scale > 0 && (
                    <div
                        role="group"
                        aria-label={copy.canvasLabel}
                        className={cn("absolute overflow-hidden", transparent && view === "after" && "bg-checkerboard")}
                        style={{ left, top, width: frameWidth, height: frameHeight }}
                    >
                        <canvas ref={backgroundRef} aria-hidden className={cn("absolute inset-0 size-full", view === "before" && "invisible")} />
                        <div
                            ref={subjectHost}
                            className={cn(
                                "absolute",
                                view === "before" && "invisible",
                                tool === "move" && view === "after" && (moving ? "outline-2 outline-[var(--color-focus-ring)]" : "outline-1 outline-dashed outline-[color-mix(in_srgb,var(--color-focus-ring)_55%,transparent)]"),
                            )}
                            style={{
                                left: `${(subjectRect.x / width) * 100}%`,
                                top: `${(subjectRect.y / height) * 100}%`,
                                width: `${placement.scale * 100}%`,
                                height: `${placement.scale * 100}%`,
                            }}
                        />
                        {view === "before" && <canvas ref={beforeRef} aria-label={copy.beforeAlt} role="img" className="absolute inset-0 size-full" />}
                        {/* Centre guides while a dragged subject is snapped to them. */}
                        {snap.x && <span aria-hidden className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--color-focus-ring)]" />}
                        {snap.y && <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--color-focus-ring)]" />}
                    </div>
                )}

                {/* Brush preview: the exact size the stroke will be, following the pointer. */}
                <div
                    ref={ringRef}
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute top-0 left-0 rounded-full border-2 opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]",
                        brush.mode === "erase" ? "border-white bg-rose-500/15" : "border-dashed border-white bg-emerald-400/15",
                    )}
                />

                {!engine.ready && !engine.error && (
                    <p role="status" className="absolute inset-0 grid place-items-center text-sm text-tertiary">
                        {copy.preparing}
                    </p>
                )}
                {engine.error && (
                    <p role="alert" className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-error-primary">
                        {copy.prepareFailed}
                    </p>
                )}
            </div>

            {/* Tools and zoom, top left — the tool you're using is always visible. */}
            <div className="pointer-events-none absolute top-3 left-3 flex flex-col gap-2">
                <div role="toolbar" aria-label={copy.canvasTools} aria-orientation="vertical" className="material pointer-events-auto flex flex-col gap-0.5 rounded-xl p-1">
                    <button type="button" className={cn(toolButton, tool === "move" && "bg-[var(--tool-soft)] text-[var(--tool)]")} onClick={() => onToolChange("move")} aria-pressed={tool === "move"} aria-label={copy.moveTool} title={`${copy.moveTool} (V)`}>
                        <Hand className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={cn(toolButton, tool === "brush" && "bg-[var(--tool-soft)] text-[var(--tool)]")} onClick={() => onToolChange("brush")} aria-pressed={tool === "brush"} aria-label={copy.brushTool} title={`${copy.brushTool} (B)`}>
                        <Brush className="size-4" aria-hidden />
                    </button>
                </div>
                <div role="toolbar" aria-label={copy.viewControls} aria-orientation="vertical" className="material pointer-events-auto flex flex-col gap-0.5 rounded-xl p-1">
                    <button type="button" className={toolButton} onClick={() => zoomAt(zoom * 1.5)} disabled={zoom >= MAX_ZOOM} aria-label={copy.zoomIn} title={`${copy.zoomIn} (+)`}>
                        <ZoomIn className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={toolButton} onClick={() => zoomAt(zoom / 1.5)} disabled={zoom <= 1} aria-label={copy.zoomOut} title={`${copy.zoomOut} (−)`}>
                        <ZoomOut className="size-4" aria-hidden />
                    </button>
                    <button type="button" className={toolButton} onClick={toggleFullscreen} aria-label={fullscreen ? copy.exitFullscreen : copy.fullscreen} aria-pressed={fullscreen}>
                        {fullscreen ? <Minimize className="size-4" aria-hidden /> : <Maximize className="size-4" aria-hidden />}
                    </button>
                </div>
            </div>

            {/* Zoom level and Fit, bottom left. */}
            <div className="pointer-events-none absolute bottom-3 left-3">
                <div className="material pointer-events-auto relative flex items-center gap-0.5 rounded-xl p-1">
                    <button
                        type="button"
                        className={cn(toolButton, "w-auto gap-1 px-2.5 text-xs font-semibold tabular-nums")}
                        onClick={() => setZoomMenu((open) => !open)}
                        aria-haspopup="menu"
                        aria-expanded={zoomMenu}
                        aria-label={copy.zoomLevel(percent)}
                    >
                        <span className="flex items-center gap-1">
                            {percent}%
                            <ChevronDown className="size-3.5 text-quaternary" aria-hidden />
                        </span>
                    </button>
                    <span aria-hidden className="h-5 w-px bg-[var(--card-line)]" />
                    <button type="button" className={cn(toolButton, "w-auto gap-1.5 px-2.5 text-xs font-semibold")} onClick={fitView} aria-label={copy.fit} title={`${copy.fit} (0)`}>
                        <span className="flex items-center gap-1.5">
                            <Scan className="size-3.5" aria-hidden />
                            {copy.fit}
                        </span>
                    </button>
                    {zoomMenu && (
                        <div role="menu" aria-label={copy.zoomMenu} className="absolute bottom-full left-0 mb-2 w-36 rounded-xl border border-[var(--card-line)] bg-primary p-1 shadow-lg">
                            {[25, 50, 100, 200, 400].map((value) => {
                                const target = value / 100 / fit;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="menuitem"
                                        disabled={target < 1 || target > MAX_ZOOM}
                                        onClick={() => {
                                            zoomAt(target);
                                            setZoomMenu(false);
                                        }}
                                        className="flex h-9 w-full cursor-pointer items-center rounded-lg px-3 text-sm text-secondary tabular-nums hover:bg-primary_hover disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-11"
                                    >
                                        {value}%
                                    </button>
                                );
                            })}
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    fitView();
                                    setZoomMenu(false);
                                }}
                                className="flex h-9 w-full cursor-pointer items-center rounded-lg px-3 text-sm text-secondary hover:bg-primary_hover pointer-coarse:h-11"
                            >
                                {copy.fitScreen}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
