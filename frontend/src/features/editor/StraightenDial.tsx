import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import { project, rubberband, SPRINGS, useSprings, VelocityTracker } from "./spring";
import { useT } from "@/i18n";

const LIMIT = 45;
const PX_PER_DEGREE = 9;
/** Landing this close to level snaps to exactly 0°. */
const DETENT = 0.75;

interface StraightenDialProps {
    value: number;
    /** Live changes while dragging or settling. */
    onChange: (degrees: number) => void;
    /** The value came to rest (record an undo step). */
    onCommit: (degrees: number) => void;
    onActiveChange?: (active: boolean) => void;
}

const clamp = (value: number) => Math.min(LIMIT, Math.max(-LIMIT, value));
const round = (value: number) => Math.round(value * 10) / 10;

/**
 * A ruler you drag like a physical dial. It tracks the finger 1:1, keeps going after a flick (Apple's momentum
 * projection), resists past ±45°, and has a detent at 0° with a light haptic tick where supported.
 */
export function StraightenDial({ value, onChange, onCommit, onActiveChange }: StraightenDialProps) {
    const t = useT();
    const reduceMotion = usePrefersReducedMotion();
    const springs = useSprings({ angle: value }, reduceMotion);
    const drag = useRef<{ id: number; x: number; start: number } | null>(null);
    const tracker = useRef(new VelocityTracker());
    const settling = useRef(false);
    const [dragging, setDragging] = useState(false);
    const shown = springs.values.angle;

    // External changes (undo, reset, flip) move the ruler too.
    useEffect(() => {
        if (drag.current || settling.current) return;
        if (Math.abs(springs.targets.angle - value) > 1e-6) springs.set({ angle: value });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // While settling after a flick, feed the animated value out; commit once it rests.
    useEffect(() => {
        if (!settling.current) return;
        const next = round(clamp(shown));
        if (next !== round(value)) onChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shown]);

    const tick = (from: number, to: number) => {
        if (Math.sign(from) !== Math.sign(to) || to === 0) navigator.vibrate?.(8);
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button > 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        settling.current = false;
        // Grab the dial where it is on screen right now, even mid-flight.
        springs.jump({ angle: shown });
        drag.current = { id: event.pointerId, x: event.clientX, start: shown };
        tracker.current.reset(shown);
        setDragging(true);
        onActiveChange?.(true);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        // Dragging the ruler left turns the photo clockwise (positive).
        const raw = current.start - (event.clientX - current.x) / PX_PER_DEGREE;
        const over = raw - clamp(raw);
        const visual = clamp(raw) + rubberband(over * PX_PER_DEGREE, 240) / PX_PER_DEGREE;
        tracker.current.add(visual);
        tick(shown, visual);
        springs.jump({ angle: visual });
        onChange(round(clamp(visual)));
    };

    const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        drag.current = null;
        setDragging(false);
        onActiveChange?.(false);

        const velocity = tracker.current.velocity;
        let target = clamp(shown + project(velocity, 0.99));
        if (Math.abs(target) < DETENT) target = 0;
        target = round(target);
        settling.current = true;
        springs.set({ angle: target }, { config: Math.abs(velocity) > 20 ? SPRINGS.momentum : SPRINGS.smooth, velocity: { angle: velocity } });
        springs.whenRested(() => {
            settling.current = false;
            onChange(target);
            onCommit(target);
        });
    };

    const setExactly = (degrees: number) => {
        const next = round(clamp(degrees));
        springs.set({ angle: next });
        onChange(next);
        onCommit(next);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 1 : 0.1;
        const actions: Record<string, number> = {
            ArrowLeft: value - step,
            ArrowDown: value - step,
            ArrowRight: value + step,
            ArrowUp: value + step,
            Home: -LIMIT,
            End: LIMIT,
            "0": 0,
        };
        const next = actions[event.key];
        if (next === undefined) return;
        event.preventDefault();
        setExactly(next);
    };

    const ticks = Array.from({ length: LIMIT * 2 + 1 }, (_, index) => index - LIMIT);
    const label = round(clamp(shown));

    return (
        <div className="flex flex-col items-center gap-2 select-none">
            <button
                type="button"
                onClick={() => setExactly(0)}
                className={cn(
                    "rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums transition-colors duration-200",
                    "outline-focus-ring focus-visible:outline-2",
                    label === 0 ? "text-tertiary" : "text-primary hover:bg-primary_hover",
                )}
                aria-label={label === 0 ? t.editor.crop.level : t.editor.crop.resetLevel(label)}
            >
                {label > 0 ? "+" : ""}
                {label.toFixed(1)}°
            </button>
            <div
                role="slider"
                tabIndex={0}
                aria-label={t.editor.crop.straighten}
                aria-valuemin={-LIMIT}
                aria-valuemax={LIMIT}
                aria-valuenow={label}
                aria-valuetext={t.editor.crop.degrees(label)}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => setExactly(0)}
                onKeyDown={onKeyDown}
                className={cn(
                    "relative h-11 w-full max-w-md touch-none overflow-hidden rounded-lg outline-none",
                    "[mask-image:linear-gradient(to_right,transparent,black_22%,black_78%,transparent)]",
                    "focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]",
                    dragging ? "cursor-grabbing" : "cursor-grab",
                )}
            >
                <div className="absolute top-1/2 left-1/2 h-full" style={{ transform: `translateX(${-shown * PX_PER_DEGREE}px)` }}>
                    {ticks.map((degree) => {
                        const major = degree % 5 === 0;
                        return (
                            <span
                                key={degree}
                                className={cn(
                                    "absolute top-1/2 w-px -translate-y-1/2 rounded-full",
                                    degree === 0 ? "h-5 bg-fg-primary" : major ? "h-4 bg-fg-quaternary" : "h-2.5 bg-fg-quaternary/60",
                                )}
                                style={{ left: degree * PX_PER_DEGREE }}
                            />
                        );
                    })}
                </div>
                {/* The fixed reading line. */}
                <span className="absolute top-1/2 left-1/2 h-7 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-focus-ring)]" />
            </div>
        </div>
    );
}
