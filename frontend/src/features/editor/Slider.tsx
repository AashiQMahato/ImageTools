import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

interface SliderProps {
    label: string;
    value: number;
    min?: number;
    max?: number;
    onChange: (value: number) => void;
    onCommit: (value: number) => void;
}

/** A centre-zero slider: fill grows from the middle, double-click resets, keys nudge. Responds on press. */
export function Slider({ label, value, min = -100, max = 100, onChange, onCommit }: SliderProps) {
    const t = useT();
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState(false);

    const fromPointer = (clientX: number) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return value;
        const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        let next = Math.round(min + fraction * (max - min));
        if (Math.abs(next) <= 2) next = 0; // gentle detent at neutral
        return next;
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button > 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        onChange(fromPointer(event.clientX));
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (dragging) onChange(fromPointer(event.clientX));
    };
    const onPointerUp = () => {
        if (!dragging) return;
        setDragging(false);
        onCommit(value);
    };
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 10 : 1;
        const actions: Record<string, number> = {
            ArrowLeft: value - step,
            ArrowDown: value - step,
            ArrowRight: value + step,
            ArrowUp: value + step,
            Home: min,
            End: max,
            "0": 0,
        };
        const next = actions[event.key];
        if (next === undefined) return;
        event.preventDefault();
        const clamped = Math.min(max, Math.max(min, next));
        onChange(clamped);
        onCommit(clamped);
    };

    const zero = ((0 - min) / (max - min)) * 100;
    const position = ((value - min) / (max - min)) * 100;

    return (
        <div className="group">
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-secondary">{label}</span>
                <button
                    type="button"
                    onClick={() => {
                        onChange(0);
                        onCommit(0);
                    }}
                    className={cn(
                        "rounded px-1 text-sm tabular-nums transition-colors duration-200 outline-focus-ring focus-visible:outline-2",
                        value === 0 ? "text-quaternary" : "text-primary",
                    )}
                    aria-label={t.editor.adjust.resetOne(label)}
                    tabIndex={value === 0 ? -1 : 0}
                >
                    {value > 0 ? "+" : ""}
                    {value}
                </button>
            </div>
            <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-label={label}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={value}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onDoubleClick={() => {
                    onChange(0);
                    onCommit(0);
                }}
                onKeyDown={onKeyDown}
                className="relative mt-2 flex h-6 cursor-pointer touch-none items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
            >
                <span className="absolute inset-x-0 h-1 rounded-full bg-[var(--seg-track)]" />
                <span
                    className="absolute h-1 rounded-full bg-fg-primary"
                    style={{ left: `${Math.min(zero, position)}%`, width: `${Math.abs(position - zero)}%` }}
                />
                <span className="absolute h-2.5 w-px -translate-x-1/2 bg-fg-quaternary" style={{ left: `${zero}%` }} />
                <span
                    className={cn(
                        "absolute size-4.5 -translate-x-1/2 rounded-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.35),0_0_0_0.5px_rgb(0_0_0/0.15)] transition-transform duration-300 ease-[var(--ease-spring)]",
                        dragging ? "scale-125" : "group-hover:scale-110",
                    )}
                    style={{ left: `${position}%` }}
                />
            </div>
        </div>
    );
}
