import { ChevronsLeftRight } from "lucide-react";
import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

type Motion = "none" | "snap";

interface CompareSliderProps {
    /** Shown to the left of the divider. */
    before: ReactNode;
    /** Shown to the right of the divider. */
    after: ReactNode;
    beforeLabel: string;
    afterLabel: string;
    /** Divider position, 0–100 (% of the width showing `before`). */
    value: number;
    /** Called when the user moves the divider (drag, click or keyboard). */
    onChange: (value: number) => void;
    className?: string;
    style?: CSSProperties;
    /** Magnify both layers identically. `origin` is in % of the frame. */
    zoom?: { scale: number; origin: { x: number; y: number } };
    /** Extra content above the layers (e.g. a status overlay). */
    children?: ReactNode;
}

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const TOUCH_SLOP = 6;

const transitions: Record<Motion, string> = {
    none: "none",
    snap: "clip-path 500ms var(--ease-spring), left 500ms var(--ease-spring)",
};

export function CompareSlider({ before, after, beforeLabel, afterLabel, value: position, onChange, className, style, zoom, children }: CompareSliderProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ id: number; startX: number; startY: number; dragging: boolean } | null>(null);
    const [motion, setMotion] = useState<Motion>("none");
    const [dragging, setDragging] = useState(false);
    const setPosition = onChange;

    const positionFromEvent = (clientX: number) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return position;
        return clamp(((clientX - rect.left) / rect.width) * 100);
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        gesture.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, dragging: false };
        // A mouse or pen commits immediately; touch waits for clear horizontal intent so vertical scrolling still works.
        if (event.pointerType !== "touch") startDrag(event, true);
    };

    const startDrag = (event: PointerEvent<HTMLDivElement>, jump: boolean) => {
        if (!gesture.current) return;
        gesture.current.dragging = true;
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (jump) {
            setMotion("snap");
            setPosition(positionFromEvent(event.clientX));
        }
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = gesture.current;
        if (!current || current.id !== event.pointerId) return;
        if (!current.dragging) {
            const dx = event.clientX - current.startX;
            const dy = event.clientY - current.startY;
            if (Math.abs(dx) < TOUCH_SLOP || Math.abs(dx) < Math.abs(dy)) return;
            startDrag(event, false);
        }
        // Track the pointer 1:1 once dragging.
        setMotion("none");
        setPosition(positionFromEvent(event.clientX));
    };

    const endDrag = () => {
        gesture.current = null;
        setDragging(false);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 10 : 2;
        const next: Record<string, number> = { ArrowLeft: position - step, ArrowRight: position + step, Home: 0, End: 100 };
        const value = next[event.key];
        if (value === undefined) return;
        event.preventDefault();
        setMotion("snap");
        setPosition(clamp(value));
    };

    const transition = transitions[motion];
    const zoomStyle: CSSProperties | undefined = zoom
        ? {
              transform: `scale(${zoom.scale})`,
              transformOrigin: `${zoom.origin.x}% ${zoom.origin.y}%`,
              transition: "transform 600ms var(--ease-spring), transform-origin 200ms var(--ease-out)",
          }
        : undefined;

    return (
        <div
            ref={containerRef}
            className={cn("relative touch-pan-y overflow-hidden select-none", dragging ? "cursor-grabbing" : "cursor-ew-resize", className)}
            style={style}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onTransitionEnd={() => motion === "snap" && setMotion("none")}
        >
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0" style={zoomStyle}>
                    {after}
                </div>
            </div>
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)`, transition }}>
                <div className="absolute inset-0" style={zoomStyle}>
                    {before}
                </div>
            </div>
            {children}

            <Label side="left" hidden={position < 22}>
                {beforeLabel}
            </Label>
            <Label side="right" hidden={position > 78}>
                {afterLabel}
            </Label>

            <div
                role="slider"
                tabIndex={0}
                aria-label={`Compare ${beforeLabel.toLowerCase()} and ${afterLabel.toLowerCase()}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(position)}
                aria-valuetext={`${Math.round(position)}% ${beforeLabel.toLowerCase()}`}
                onKeyDown={onKeyDown}
                className={cn(
                    "group absolute inset-y-0 -ml-5 flex w-10 justify-center outline-none transition-opacity duration-300",
                    // At either edge there's nothing to compare, so the handle steps aside.
                    !dragging && (position < 1.5 || position > 98.5) && "opacity-0 focus-visible:opacity-100",
                )}
                style={{ left: `${position}%`, transition: transition === "none" ? undefined : `${transition}, opacity 300ms` }}
            >
                <span className="h-full w-0.5 bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.12)]" />
                <span
                    className={cn(
                        "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-neutral-900 shadow-[0_4px_16px_rgb(0_0_0/0.2),0_0_0_0.5px_rgb(0_0_0/0.1)] backdrop-blur-md transition-transform duration-500 ease-[var(--ease-spring)]",
                        dragging && "scale-[1.15]",
                        "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-white",
                    )}
                >
                    <ChevronsLeftRight className="size-4" aria-hidden />
                </span>
            </div>
        </div>
    );
}

function Label({ side, hidden, children }: { side: "left" | "right"; hidden: boolean; children: ReactNode }) {
    return (
        <span
            aria-hidden
            className={cn(
                "pointer-events-none absolute top-4 rounded-full bg-neutral-950/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md transition-opacity duration-300 md:top-6",
                side === "left" ? "left-4 md:left-6" : "right-4 md:right-6",
                hidden ? "opacity-0" : "opacity-100",
            )}
        >
            {children}
        </span>
    );
}
