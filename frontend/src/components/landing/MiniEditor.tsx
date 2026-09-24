import { RotateCw, TrianglesCenterlineDashedVertical } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from "react";
import { images } from "@/assets/images/landing";
import { Button } from "@/components/ui/base/buttons/button";
import { cn } from "@/lib/utils/cn";

/** Pixel size of the source photo, used for the output readout. */
const SOURCE = { width: 4025, height: 2673 };
const IMAGE_ASPECT = SOURCE.width / SOURCE.height;
/** How much of the largest possible crop a preset fills. */
const FILL = 0.8;

const PRESETS = [
    { id: "original", label: "Original", ratio: null },
    { id: "square", label: "1:1", ratio: 1 },
    { id: "portrait", label: "4:5", ratio: 4 / 5 },
    { id: "wide", label: "16:9", ratio: 16 / 9 },
] as const;

type PresetId = (typeof PRESETS)[number]["id"];

/** Crop rectangle in fractions of the (unrotated) photo. */
interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const FULL_FRAME: Rect = { x: 0, y: 0, w: 1, h: 1 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The further past an edge, the less the frame follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function rectForPreset(preset: PresetId, quarterTurns: number, center: { x: number; y: number }): Rect {
    const ratio = PRESETS.find((p) => p.id === preset)?.ratio ?? null;
    // Ratios describe the output as seen; when the photo is on its side, the crop is the other way round in photo space.
    const sideways = Math.abs(quarterTurns % 2) === 1;
    const aspect = ratio === null ? IMAGE_ASPECT : sideways ? 1 / ratio : ratio;

    const w = aspect >= IMAGE_ASPECT ? FILL : (FILL * aspect) / IMAGE_ASPECT;
    const h = aspect >= IMAGE_ASPECT ? (FILL * IMAGE_ASPECT) / aspect : FILL;
    return { w, h, x: clamp(center.x - w / 2, 0, 1 - w), y: clamp(center.y - h / 2, 0, 1 - h) };
}

export function MiniEditor({ play }: { play: boolean }) {
    const areaRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const [area, setArea] = useState({ width: 0, height: 0 });
    const [preset, setPreset] = useState<PresetId>("portrait");
    const [quarterTurns, setQuarterTurns] = useState(0);
    const [flipped, setFlipped] = useState(false);
    const [rect, setRect] = useState<Rect>(FULL_FRAME);
    const [dragging, setDragging] = useState(false);
    const drag = useRef<{ id: number; x: number; y: number; start: Rect } | null>(null);
    const played = useRef(false);

    // On first view, the frame tightens from the full photo to a portrait crop around the flamingo.
    useEffect(() => {
        if (!play || played.current) return;
        played.current = true;
        setRect(rectForPreset("portrait", 0, { x: 0.5, y: 0.5 }));
    }, [play]);

    useEffect(() => {
        const element = areaRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setArea({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Fit the photo in the canvas; when it's on its side, scale it down so the rotated photo still fits.
    const stageWidth = Math.min(area.width, area.height * IMAGE_ASPECT);
    const stageHeight = stageWidth / IMAGE_ASPECT;
    const sideways = Math.abs(quarterTurns % 2) === 1;
    const scale = sideways && stageWidth > 0 ? Math.min(area.width / stageHeight, area.height / stageWidth) : 1;
    const angle = quarterTurns * 90;

    const center = () => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

    const choosePreset = (id: PresetId) => {
        setPreset(id);
        setRect(rectForPreset(id, quarterTurns, center()));
    };

    // The flip is applied on screen, outside the rotation, so a mirrored photo turns the other way internally
    // to keep "rotate" clockwise as seen.
    const rotate = () => {
        const next = quarterTurns + (flipped ? -1 : 1);
        setQuarterTurns(next);
        setRect(rectForPreset(preset, next, center()));
    };

    // Convert a pointer movement on screen into photo-space fractions (undo flip, then rotation, then scale).
    const toPhotoDelta = (screenDx: number, dy: number) => {
        const dx = flipped ? -screenDx : screenDx;
        const theta = (angle * Math.PI) / 180;
        const x = (dx * Math.cos(theta) + dy * Math.sin(theta)) / scale;
        const y = (-dx * Math.sin(theta) + dy * Math.cos(theta)) / scale;
        return { x: x / stageWidth, y: y / stageHeight };
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: rect };
        setDragging(true);
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const delta = toPhotoDelta(event.clientX - current.x, event.clientY - current.y);
        const resist = (value: number, max: number, size: number) => {
            if (value < 0) return -rubberband(-value * size, size) / size;
            if (value > max) return max + rubberband((value - max) * size, size) / size;
            return value;
        };
        setRect({
            ...current.start,
            x: resist(current.start.x + delta.x, 1 - current.start.w, stageWidth),
            y: resist(current.start.y + delta.y, 1 - current.start.h, stageHeight),
        });
    };

    const onPointerUp = () => {
        drag.current = null;
        setDragging(false);
        // Settle back inside the photo.
        setRect((r) => ({ ...r, x: clamp(r.x, 0, 1 - r.w), y: clamp(r.y, 0, 1 - r.h) }));
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 0.05 : 0.01;
        const moves: Record<string, [number, number]> = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, -step],
            ArrowDown: [0, step],
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        const [dx, dy] = move;
        setRect((r) => ({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) }));
    };

    let outputWidth = Math.round(rect.w * SOURCE.width);
    let outputHeight = Math.round(rect.h * SOURCE.height);
    if (sideways) [outputWidth, outputHeight] = [outputHeight, outputWidth];
    const format = (value: number) => value.toLocaleString("en-US");

    return (
        <div className="overflow-hidden rounded-[1.25rem] bg-primary shadow-canvas">
            <div className="bg-primary p-4 sm:p-6">
                <div ref={areaRef} className="relative flex aspect-[3/2] items-center justify-center">
                    <div
                        ref={stageRef}
                        className="relative overflow-hidden rounded-md transition-transform duration-[600ms] ease-[var(--ease-spring)] motion-reduce:transition-none"
                        style={{
                            width: stageWidth,
                            height: stageHeight,
                            transform: `scaleX(${flipped ? -1 : 1}) rotate(${angle}deg) scale(${scale})`,
                        }}
                    >
                        <img
                            {...images.flamingo}
                            sizes="(min-width: 1024px) 640px, 100vw"
                            alt="A flamingo curving its neck against dark green foliage"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                            className="size-full object-cover select-none"
                        />
                        <div
                            role="group"
                            tabIndex={0}
                            aria-label="Crop area. Drag, or use the arrow keys, to move it."
                            className={cn(
                                "absolute cursor-move touch-none shadow-[0_0_0_9999px_rgb(10_10_10/0.55)] outline-none ring-1 ring-white/90",
                                "focus-visible:ring-2",
                                !dragging &&
                                    "transition-[left,top,width,height] duration-[600ms] ease-[var(--ease-spring)] motion-reduce:transition-none",
                            )}
                            style={{
                                left: `${rect.x * 100}%`,
                                top: `${rect.y * 100}%`,
                                width: `${rect.w * 100}%`,
                                height: `${rect.h * 100}%`,
                            }}
                            onPointerDown={onPointerDown}
                            onPointerMove={onPointerMove}
                            onPointerUp={onPointerUp}
                            onPointerCancel={onPointerUp}
                            onKeyDown={onKeyDown}
                        >
                            <Thirds strong={dragging} />
                            <Corners />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between gap-1 border-t border-secondary px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
                <div role="radiogroup" aria-label="Aspect ratio" className="flex items-center gap-0.5">
                    {PRESETS.map((option) => {
                        const checked = option.id === preset;
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                onClick={() => choosePreset(option.id)}
                                className={cn(
                                    "min-h-10 cursor-pointer rounded-full px-2.5 text-sm font-medium tabular-nums sm:px-3 transition-[color,background-color,scale] duration-200 active:scale-[0.96]",
                                    "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-1",
                                    checked ? "bg-secondary text-primary dark:bg-tertiary" : "text-tertiary hover:text-primary",
                                )}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-0.5">
                    <output aria-label="Output size" className="mr-2 hidden text-sm text-tertiary tabular-nums sm:inline">
                        {format(outputWidth)} × {format(outputHeight)}
                    </output>
                    <Button size="sm" color="tertiary" iconLeading={RotateCw} aria-label="Rotate 90°" onPress={rotate} className="press-scale rounded-full before:rounded-full" />
                    <Button
                        size="sm"
                        color="tertiary"
                        iconLeading={TrianglesCenterlineDashedVertical}
                        aria-label="Flip horizontally"
                        aria-pressed={flipped}
                        onPress={() => setFlipped((f) => !f)}
                        className="press-scale rounded-full before:rounded-full"
                    />
                </div>
            </div>
        </div>
    );
}

function Thirds({ strong }: { strong: boolean }) {
    const line = cn("absolute bg-white transition-opacity duration-200", strong ? "opacity-60" : "opacity-25");
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className={cn(line, "inset-y-0 left-1/3 w-px")} />
            <span className={cn(line, "inset-y-0 left-2/3 w-px")} />
            <span className={cn(line, "inset-x-0 top-1/3 h-px")} />
            <span className={cn(line, "inset-x-0 top-2/3 h-px")} />
        </div>
    );
}

function Corners() {
    const corner = "absolute size-3.5 border-white";
    return (
        <div aria-hidden className="pointer-events-none absolute -inset-[2px]">
            <span className={cn(corner, "top-0 left-0 border-t-[3px] border-l-[3px]")} />
            <span className={cn(corner, "top-0 right-0 border-t-[3px] border-r-[3px]")} />
            <span className={cn(corner, "bottom-0 left-0 border-b-[3px] border-l-[3px]")} />
            <span className={cn(corner, "right-0 bottom-0 border-r-[3px] border-b-[3px]")} />
        </div>
    );
}
