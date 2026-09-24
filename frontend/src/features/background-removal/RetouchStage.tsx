import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { MIN_RADIUS, type BrushMode, type Point, type Selection, TAP_RADIUS } from "./retouch";

interface RetouchStageProps {
    /** Full-resolution working copy owned by useRetouch. */
    canvas: RefObject<HTMLCanvasElement | null>;
    /** Bumped whenever the working copy changes, so the visible copy repaints. */
    revision: number;
    size: { width: number; height: number };
    mode: BrushMode;
    selection: Selection | null;
    onSelect: (selection: Selection | null) => void;
    onApply: () => void;
}

/**
 * The cut-out, with a circular area selector over it. Dragging from the centre outwards sizes the
 * circle; nothing is changed until the area is applied, so the ring is a promise of exactly which
 * pixels will move. Positions are kept in source pixels, so a selection survives a resize.
 */
export function RetouchStage({ canvas, revision, size, mode, selection, onSelect, onApply }: RetouchStageProps) {
    const t = useT();
    const viewRef = useRef<HTMLCanvasElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const centre = useRef<Point | null>(null);
    const [dragging, setDragging] = useState(false);

    // Mirror the working copy onto the visible, scaled canvas.
    useEffect(() => {
        const source = canvas.current;
        const view = viewRef.current;
        if (!source || !view) return;
        if (view.width !== source.width || view.height !== source.height) {
            view.width = source.width;
            view.height = source.height;
        }
        const context = view.getContext("2d");
        if (!context) return;
        context.clearRect(0, 0, view.width, view.height);
        context.drawImage(source, 0, 0);
    }, [canvas, revision]);

    const scale = canvas.current && size.width ? canvas.current.width / size.width : 1;

    const toSource = (event: PointerEvent<HTMLDivElement>): Point | null => {
        const rect = frameRef.current?.getBoundingClientRect();
        if (!rect || rect.width === 0) return null;
        const factor = canvas.current ? canvas.current.width / rect.width : 1;
        return { x: (event.clientX - rect.left) * factor, y: (event.clientY - rect.top) * factor };
    };

    return (
        <div
            ref={frameRef}
            className="animate-enter bg-checkerboard relative cursor-crosshair touch-none overflow-hidden rounded-xl shadow-canvas [--i:-1]"
            style={size}
            role="application"
            aria-label={mode === "erase" ? t.pages.removeBackground.eraseAria : t.pages.removeBackground.restoreAria}
            onPointerDown={(event) => {
                const point = toSource(event);
                if (!point) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                centre.current = point;
                setDragging(true);
                onSelect({ ...point, radius: 0 });
            }}
            onPointerMove={(event) => {
                if (!centre.current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                const point = toSource(event);
                if (!point) return;
                onSelect({ ...centre.current, radius: Math.hypot(point.x - centre.current.x, point.y - centre.current.y) });
            }}
            onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
                setDragging(false);
                const origin = centre.current;
                centre.current = null;
                // A tap rather than a drag still means "this spot" — give it a usable default.
                if (origin && selection && selection.radius < MIN_RADIUS) onSelect({ ...origin, radius: TAP_RADIUS * scale });
            }}
            onPointerCancel={() => {
                centre.current = null;
                setDragging(false);
                onSelect(null);
            }}
            onDoubleClick={onApply}
        >
            <canvas ref={viewRef} className="size-full object-contain" />

            {selection && selection.radius > 0 && (
                <span
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                        dragging ? "transition-none" : "transition-[width,height] duration-150 ease-[var(--ease-out)]",
                        mode === "erase" ? "border-white bg-rose-500/25 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]" : "border-dashed border-white bg-emerald-400/20 shadow-[0_0_0_1px_rgba(0,0,0,0.45)]",
                    )}
                    style={{
                        left: selection.x / scale,
                        top: selection.y / scale,
                        width: (selection.radius * 2) / scale,
                        height: (selection.radius * 2) / scale,
                    }}
                />
            )}

            {!selection && (
                <p className="material pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-medium text-primary">
                    {t.pages.removeBackground.selectHint}
                </p>
            )}
        </div>
    );
}
