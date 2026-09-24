import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type WheelEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import { type CropRect, constrainTowards, fits, type Handle, MIN_CROP, orientedSize, resizeFromHandle } from "./geometry";
import type { EditState } from "./render";
import { rubberband, SPRINGS, useSprings, VelocityTracker } from "./spring";
import { useT } from "@/i18n";

interface CropStageProps {
    source: { width: number; height: number };
    edit: EditState;
    /** The picture itself (a canvas), sized to fill its box. */
    image: ReactNode;
    /** Crop mode shows the frame and accepts gestures; otherwise the stage just presents the result. */
    interactive: boolean;
    /** Locked aspect ratio (w/h) for the frame, or null for freeform. */
    aspect: number | null;
    /** True while the straighten dial is being dragged: shows a fine grid. */
    straightening?: boolean;
    onPreview: (next: EditState) => void;
    onCommit: (next: EditState) => void;
    className?: string;
}

type Gesture =
    | { kind: "pan"; id: number; x: number; y: number; start: CropRect; scale: number }
    | { kind: "resize"; id: number; x: number; y: number; start: CropRect; handle: Handle; scale: number; view: { cx: number; cy: number } }
    | { kind: "pinch"; ids: [number, number]; distance: number; start: CropRect };

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSORS: Record<Handle, string> = {
    n: "ns-resize",
    s: "ns-resize",
    e: "ew-resize",
    w: "ew-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    nw: "nwse-resize",
    se: "nwse-resize",
};

function useElementSize<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return [ref, size] as const;
}

export function CropStage({ source, edit, image, interactive, aspect, straightening = false, onPreview, onCommit, className }: CropStageProps) {
    const t = useT();
    const reduceMotion = usePrefersReducedMotion();
    const [stageRef, stage] = useElementSize<HTMLDivElement>();
    const { crop, orientation } = edit;
    const oriented = orientedSize(source.width, source.height, orientation.quarter);
    const padding = interactive ? Math.min(56, Math.max(28, stage.width * 0.05)) : Math.min(24, stage.width * 0.03);

    /** View scale that fits a rect inside the stage padding. */
    const fitScale = (rect: CropRect) =>
        stage.width > 0 ? Math.min((stage.width - padding * 2) / rect.w, (stage.height - padding * 2) / rect.h) : 0.0001;

    const springs = useSprings(
        { vcx: crop.cx, vcy: crop.cy, s: 0.0001, rot: -90 * orientation.quarter, fx: 1, fy: 1, cx: crop.cx, cy: crop.cy, cw: crop.w, ch: crop.h },
        reduceMotion,
    );
    const v = springs.values;

    const gesture = useRef<Gesture | null>(null);
    const pointers = useRef(new Map<number, { x: number; y: number }>());
    const velocityX = useRef(new VelocityTracker());
    const velocityY = useRef(new VelocityTracker());
    const [active, setActive] = useState<"pan" | "resize" | "pinch" | null>(null);
    const previous = useRef(edit);
    const firstLayout = useRef(true);

    // Follow edits made elsewhere (presets, undo, rotate, flip, straighten) — animating from what's on screen now.
    useEffect(() => {
        if (gesture.current || stage.width === 0) return;
        const before = previous.current;
        previous.current = edit;
        const scale = fitScale(edit.crop);
        const fx = edit.orientation.flipX ? -1 : 1;
        const fy = edit.orientation.flipY ? -1 : 1;

        if (firstLayout.current) {
            firstLayout.current = false;
            springs.jump({ vcx: edit.crop.cx, vcy: edit.crop.cy, s: scale, rot: -90 * edit.orientation.quarter, fx, fy, cx: edit.crop.cx, cy: edit.crop.cy, cw: edit.crop.w, ch: edit.crop.h });
            return;
        }

        const turned = before.orientation.quarter !== edit.orientation.quarter;
        const flipped = before.orientation.flipX !== edit.orientation.flipX || before.orientation.flipY !== edit.orientation.flipY;
        if (turned || flipped) {
            // The new layout is already correct; the photo and frame rotate/mirror into it together.
            springs.jump({ vcx: edit.crop.cx, vcy: edit.crop.cy, cx: edit.crop.cx, cy: edit.crop.cy, cw: edit.crop.w, ch: edit.crop.h });
            springs.set({ rot: -90 * edit.orientation.quarter }, { config: SPRINGS.rotation });
            springs.set({ fx, fy, s: scale });
            return;
        }
        if (before.orientation.angle !== edit.orientation.angle) {
            // Straightening tracks the dial 1:1; the view zooms so the frame stays the same size on screen.
            springs.jump({ vcx: edit.crop.cx, vcy: edit.crop.cy, s: scale, cx: edit.crop.cx, cy: edit.crop.cy, cw: edit.crop.w, ch: edit.crop.h });
            return;
        }
        springs.set({ vcx: edit.crop.cx, vcy: edit.crop.cy, s: scale, cx: edit.crop.cx, cy: edit.crop.cy, cw: edit.crop.w, ch: edit.crop.h });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [edit, stage.width, stage.height, interactive]);

    const withCrop = (next: CropRect): EditState => ({ ...edit, crop: next });

    // ---------------------------------------------------------------- gestures

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (!interactive || event.button > 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.entries()];
            if (a && b) {
                gesture.current = { kind: "pinch", ids: [a[0], b[0]], distance: Math.hypot(a[1].x - b[1].x, a[1].y - b[1].y), start: edit.crop };
                setActive("pinch");
            }
            return;
        }

        const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-handle]")?.dataset.handle as Handle | undefined;
        const scale = v.s;
        if (handle) {
            gesture.current = { kind: "resize", id: event.pointerId, x: event.clientX, y: event.clientY, start: edit.crop, handle, scale, view: { cx: v.vcx, cy: v.vcy } };
            setActive("resize");
        } else {
            gesture.current = { kind: "pan", id: event.pointerId, x: event.clientX, y: event.clientY, start: edit.crop, scale };
            velocityX.current.reset(edit.crop.cx);
            velocityY.current.reset(edit.crop.cy);
            setActive("pan");
        }
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const current = gesture.current;
        if (!current) return;
        const { width, height } = oriented;
        const { angle } = orientation;

        if (current.kind === "pinch") {
            const a = pointers.current.get(current.ids[0]);
            const b = pointers.current.get(current.ids[1]);
            if (!a || !b) return;
            zoomBy(current.start, current.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), false);
            return;
        }

        const dx = (event.clientX - current.x) / current.scale;
        const dy = (event.clientY - current.y) / current.scale;

        if (current.kind === "pan") {
            // The photo follows the finger, so the crop moves the opposite way.
            const candidate = { ...current.start, cx: current.start.cx - dx, cy: current.start.cy - dy };
            const valid = constrainTowards(current.start, candidate, angle, width, height);
            const shown = {
                cx: valid.cx + rubberband((candidate.cx - valid.cx) * current.scale, stage.width) / current.scale,
                cy: valid.cy + rubberband((candidate.cy - valid.cy) * current.scale, stage.height) / current.scale,
            };
            velocityX.current.add(shown.cx);
            velocityY.current.add(shown.cy);
            springs.jump({ vcx: shown.cx, vcy: shown.cy, cx: shown.cx, cy: shown.cy });
            onPreview(withCrop(valid));
            return;
        }

        const minSize = Math.max(MIN_CROP, 56 / current.scale);
        const candidate = resizeFromHandle(current.start, current.handle, dx, dy, aspect, minSize);
        const valid = constrainTowards(current.start, candidate, angle, width, height);
        const band = (delta: number, dimension: number) => rubberband(delta * current.scale, dimension) / current.scale;
        springs.jump({
            cx: valid.cx + band(candidate.cx - valid.cx, stage.width),
            cy: valid.cy + band(candidate.cy - valid.cy, stage.height),
            cw: valid.w + band(candidate.w - valid.w, stage.width),
            ch: valid.h + band(candidate.h - valid.h, stage.height),
        });
        onPreview(withCrop(valid));
    };

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        pointers.current.delete(event.pointerId);
        const current = gesture.current;
        if (!current) return;
        if (current.kind === "pinch" && pointers.current.size > 0) {
            // One finger lifted: stop pinching; the remaining finger must be lifted and put down again to pan.
            gesture.current = null;
            setActive(null);
            onCommit(edit);
            return;
        }
        gesture.current = null;
        setActive(null);
        const final = edit.crop;
        const scale = fitScale(final);
        if (current.kind === "pan") {
            // Settle from wherever the rubber band left it, carrying the finger's velocity.
            const velocity = { vcx: velocityX.current.velocity, vcy: velocityY.current.velocity, cx: velocityX.current.velocity, cy: velocityY.current.velocity };
            springs.set({ vcx: final.cx, vcy: final.cy, cx: final.cx, cy: final.cy, s: scale }, { velocity });
        } else {
            // Snap back from any rubber-banding, then glide the frame back to the centre and fill the stage.
            springs.set({ cx: final.cx, cy: final.cy, cw: final.w, ch: final.h, vcx: final.cx, vcy: final.cy, s: scale });
        }
        previous.current = edit;
        onCommit(edit);
    };

    /** Zoom the photo (shrink/grow the crop about its centre), keeping the frame's on-screen size. */
    const zoomBy = (start: CropRect, factor: number, commit: boolean) => {
        const { width, height } = oriented;
        let w = Math.max(MIN_CROP, start.w * factor);
        let h = w * (start.h / start.w);
        if (h < MIN_CROP) {
            h = MIN_CROP;
            w = h * (start.w / start.h);
        }
        const candidate = { ...start, w, h };
        const valid = fits(candidate, orientation.angle, width, height) ? candidate : constrainTowards(start, candidate, orientation.angle, width, height);
        springs.jump({ cx: valid.cx, cy: valid.cy, cw: valid.w, ch: valid.h, vcx: valid.cx, vcy: valid.cy, s: fitScale(valid) });
        previous.current = withCrop(valid);
        if (commit) onCommit(withCrop(valid));
        else onPreview(withCrop(valid));
    };

    // Trackpad pinch arrives as ctrl + wheel. Plain wheel scrolls the page as usual.
    const wheelCommit = useRef<number>(undefined);
    const onWheel = (event: WheelEvent<HTMLDivElement>) => {
        if (!interactive || !event.ctrlKey) return;
        event.preventDefault();
        zoomBy(edit.crop, Math.exp(event.deltaY * 0.01), false);
        window.clearTimeout(wheelCommit.current);
        wheelCommit.current = window.setTimeout(() => onCommit(useLatest.current), 250);
    };
    const useLatest = useRef(edit);
    useLatest.current = edit;

    // Native listener so preventDefault works for ctrl+wheel (React's wheel listener is passive).
    useEffect(() => {
        const element = stageRef.current;
        if (!element) return;
        const block = (event: globalThis.WheelEvent) => {
            if (interactive && event.ctrlKey) event.preventDefault();
        };
        element.addEventListener("wheel", block, { passive: false });
        return () => element.removeEventListener("wheel", block);
    }, [interactive, stageRef]);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!interactive) return;
        const step = (event.shiftKey ? 0.1 : 0.02) * Math.min(edit.crop.w, edit.crop.h);
        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        const move = moves[event.key];
        if (move) {
            event.preventDefault();
            const candidate = { ...edit.crop, cx: edit.crop.cx + move[0], cy: edit.crop.cy + move[1] };
            onCommit(withCrop(constrainTowards(edit.crop, candidate, orientation.angle, oriented.width, oriented.height)));
        } else if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            zoomBy(edit.crop, 0.9, true);
        } else if (event.key === "-") {
            event.preventDefault();
            zoomBy(edit.crop, 1 / 0.9, true);
        }
    };

    // ---------------------------------------------------------------- layout

    const fxTarget = orientation.flipX ? -1 : 1;
    const fyTarget = orientation.flipY ? -1 : 1;
    const residualRotation = v.rot - -90 * orientation.quarter;
    const residualFlipX = v.fx / fxTarget;
    const residualFlipY = v.fy / fyTarget;

    const frame = {
        left: stage.width / 2 + (v.cx - v.cw / 2 - v.vcx) * v.s,
        top: stage.height / 2 + (v.cy - v.ch / 2 - v.vcy) * v.s,
        width: v.cw * v.s,
        height: v.ch * v.s,
    };
    const ready = stage.width > 0 && v.s > 0.001;
    const size = { width: Math.round(edit.crop.w), height: Math.round(edit.crop.h) };

    return (
        <div
            ref={stageRef}
            role={interactive ? "application" : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={interactive ? t.editor.cropStage : undefined}
            aria-roledescription={interactive ? t.editor.cropRole : undefined}
            className={cn(
                "relative touch-none overflow-hidden outline-none select-none",
                "focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] focus-visible:ring-inset",
                interactive && (active === "pan" ? "cursor-grabbing" : "cursor-grab"),
                className,
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onKeyDown={onKeyDown}
        >
            <div
                className="absolute inset-0"
                style={{
                    transform: `rotate(${residualRotation}deg) scale(${residualFlipX}, ${residualFlipY})`,
                    opacity: ready ? 1 : 0,
                    transition: "opacity 300ms",
                }}
            >
                {/* The photo, positioned in source pixels and scaled by the view. */}
                <div
                    className="absolute top-0 left-0"
                    style={{ transform: `translate(${stage.width / 2}px, ${stage.height / 2}px) scale(${v.s}) translate(${-v.vcx}px, ${-v.vcy}px)`, transformOrigin: "0 0" }}
                >
                    <div
                        className="absolute bg-checkerboard"
                        style={{
                            left: -source.width / 2,
                            top: -source.height / 2,
                            width: source.width,
                            height: source.height,
                            transform: `rotate(${orientation.angle}deg) scale(${fxTarget}, ${fyTarget}) rotate(${-90 * orientation.quarter}deg)`,
                            backgroundSize: `${20 / Math.max(v.s, 0.001)}px ${20 / Math.max(v.s, 0.001)}px`,
                        }}
                    >
                        {image}
                    </div>
                </div>

                {/* Everything outside the crop is dimmed while cropping, and hidden otherwise. */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute transition-[box-shadow] duration-500"
                    style={{
                        ...frame,
                        // Outside the frame: a theme-aware scrim while cropping, the stage colour otherwise.
                        boxShadow: `0 0 0 100vmax ${interactive ? (active ? "var(--crop-scrim-active)" : "var(--crop-scrim)") : "var(--studio-stage)"}`,
                    }}
                />

                {interactive && (
                    <div className="absolute" style={frame}>
                        <div className="pointer-events-none absolute inset-0 shadow-[0_0_0_1px_rgb(255_255_255/0.9),0_0_0_2px_rgb(0_0_0/0.18)]" />
                        <Grid divisions={straightening ? 8 : 3} visible={Boolean(active) || straightening} />
                        <Corners />
                        {HANDLES.map((handle) => (
                            <span
                                key={handle}
                                data-handle={handle}
                                aria-hidden
                                className="absolute z-10"
                                style={{ ...handleBox(handle), cursor: CURSORS[handle] }}
                            />
                        ))}
                        <span
                            aria-live="polite"
                            className={cn(
                                "material pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap text-primary tabular-nums transition-opacity duration-200",
                                active === "resize" || active === "pinch" ? "opacity-100" : "opacity-0",
                            )}
                        >
                            {size.width.toLocaleString("en-US")} × {size.height.toLocaleString("en-US")}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/** 44px hit areas: corners are squares, edges are strips between them. */
function handleBox(handle: Handle): CSSProperties {
    const hit = 44;
    const half = hit / 2;
    const style: CSSProperties = {};
    if (handle.length === 2) {
        style.width = hit;
        style.height = hit;
        style[handle.includes("n") ? "top" : "bottom"] = -half;
        style[handle.includes("w") ? "left" : "right"] = -half;
    } else if (handle === "n" || handle === "s") {
        style.left = half;
        style.right = half;
        style.height = hit;
        style[handle === "n" ? "top" : "bottom"] = -half;
    } else {
        style.top = half;
        style.bottom = half;
        style.width = hit;
        style[handle === "w" ? "left" : "right"] = -half;
    }
    return style;
}

function Corners() {
    const corner = "absolute size-5 border-white";
    const edge = "absolute bg-white rounded-full";
    return (
        // A soft shadow keeps white handles legible on light photos and on the light scrim.
        <div aria-hidden className="pointer-events-none absolute -inset-[3px] drop-shadow-[0_1px_2px_rgb(0_0_0/0.35)]">
            <span className={cn(corner, "top-0 left-0 border-t-[3px] border-l-[3px]")} />
            <span className={cn(corner, "top-0 right-0 border-t-[3px] border-r-[3px]")} />
            <span className={cn(corner, "bottom-0 left-0 border-b-[3px] border-l-[3px]")} />
            <span className={cn(corner, "right-0 bottom-0 border-r-[3px] border-b-[3px]")} />
            <span className={cn(edge, "top-0 left-1/2 h-[3px] w-6 -translate-x-1/2")} />
            <span className={cn(edge, "bottom-0 left-1/2 h-[3px] w-6 -translate-x-1/2")} />
            <span className={cn(edge, "top-1/2 left-0 h-6 w-[3px] -translate-y-1/2")} />
            <span className={cn(edge, "top-1/2 right-0 h-6 w-[3px] -translate-y-1/2")} />
        </div>
    );
}

function Grid({ divisions, visible }: { divisions: number; visible: boolean }) {
    const lines = Array.from({ length: divisions - 1 }, (_, index) => ((index + 1) / divisions) * 100);
    return (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-300", visible ? "opacity-100" : "opacity-0")}>
            {lines.map((position) => (
                <span key={`v${position}`} className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${position}%` }} />
            ))}
            {lines.map((position) => (
                <span key={`h${position}`} className="absolute inset-x-0 h-px bg-white/40" style={{ top: `${position}%` }} />
            ))}
        </div>
    );
}
