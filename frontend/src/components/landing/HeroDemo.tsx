import { Download, Eraser, RotateCcw } from "lucide-react";
import { type PointerEvent, type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { images, KINGFISHER_CUTOUT_PNG } from "@/assets/images/landing";
import { Button } from "@/components/ui/base/buttons/button";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";

type Phase = "idle" | "processing" | "done";
type Motion = "none" | "follow" | "settle" | "process" | "compare";

export interface HeroDemoHandle {
    run: () => void;
}

const PROCESS_MS = 1400;

const transitions: Record<Motion, string> = {
    none: "none",
    follow: "clip-path 320ms var(--ease-out), left 320ms var(--ease-out)",
    settle: "clip-path 600ms var(--ease-out), left 600ms var(--ease-out)",
    process: `clip-path ${PROCESS_MS}ms var(--ease-in-out), left ${PROCESS_MS}ms var(--ease-in-out)`,
    compare: "clip-path 240ms var(--ease-out), left 240ms var(--ease-out)",
};

const imageClass = "absolute inset-0 size-full object-cover object-[30%_50%] sm:object-center";

/**
 * A working miniature of background removal, using a real cut-out of the photo.
 * `split` is how much of the frame (from the left, in %) shows the result.
 */
export function HeroDemo({ ref }: { ref?: Ref<HeroDemoHandle> }) {
    const reduceMotion = usePrefersReducedMotion();
    const [phase, setPhase] = useState<Phase>("idle");
    const [split, setSplit] = useState(0);
    const [motion, setMotion] = useState<Motion>("none");
    const followTimer = useRef<number>(undefined);
    const processTimer = useRef<number>(undefined);

    useEffect(
        () => () => {
            window.clearTimeout(followTimer.current);
            window.clearTimeout(processTimer.current);
        },
        [],
    );

    const run = () => {
        if (phase !== "idle") return;
        window.clearTimeout(followTimer.current);
        setPhase("processing");
        setMotion(reduceMotion ? "none" : "process");
        setSplit(100);
        processTimer.current = window.setTimeout(() => setPhase("done"), reduceMotion ? 0 : PROCESS_MS);
    };

    const reset = () => {
        setPhase("idle");
        setMotion(reduceMotion ? "none" : "settle");
        setSplit(0);
    };

    useImperativeHandle(ref, () => ({ run }));

    // Hovering (mouse only) previews the result up to the cursor.
    const splitFromPointer = (event: PointerEvent<HTMLElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    };

    const onPointerEnter = (event: PointerEvent<HTMLElement>) => {
        if (phase !== "idle" || event.pointerType !== "mouse" || reduceMotion) return;
        // Ease to the cursor first, then track it 1:1.
        setMotion("follow");
        setSplit(splitFromPointer(event));
        window.clearTimeout(followTimer.current);
        followTimer.current = window.setTimeout(() => setMotion("none"), 320);
    };

    const onPointerMove = (event: PointerEvent<HTMLElement>) => {
        if (phase !== "idle" || event.pointerType !== "mouse" || reduceMotion) return;
        setSplit(splitFromPointer(event));
    };

    const onPointerLeave = (event: PointerEvent<HTMLElement>) => {
        if (phase !== "idle" || event.pointerType !== "mouse") return;
        window.clearTimeout(followTimer.current);
        setMotion("settle");
        setSplit(0);
    };

    const compare = (showOriginal: boolean) => {
        setMotion(reduceMotion ? "none" : "compare");
        setSplit(showOriginal ? 0 : 100);
    };

    const transition = transitions[motion];
    const lineVisible = split > 0.5 && split < 99.5;

    return (
        <figure className="relative">
            <div
                className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-canvas shadow-canvas sm:aspect-[16/10]"
                onPointerEnter={onPointerEnter}
                onPointerMove={onPointerMove}
                onPointerLeave={onPointerLeave}
            >
                <div className="absolute inset-0 bg-checkerboard" />
                <img
                    {...images.kingfisherCutout}
                    sizes="(min-width: 1200px) 1136px, 100vw"
                    alt=""
                    decoding="async"
                    draggable={false}
                    className={imageClass}
                />
                <img
                    {...images.kingfisher}
                    sizes="(min-width: 1200px) 1136px, 100vw"
                    alt="A common kingfisher perched on a mossy branch against a soft, blurred background"
                    fetchPriority="high"
                    draggable={false}
                    className={imageClass}
                    style={{ clipPath: `inset(0 0 0 ${split}%)`, transition }}
                />

                {/* The edge of the processed region. */}
                <span
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.14),0_0_12px_rgb(255_255_255/0.6)] transition-opacity duration-200",
                        lineVisible ? "opacity-100" : "opacity-0",
                    )}
                    style={{ left: `${split}%`, transition: `${transition === "none" ? "" : `${transition}, `}opacity 200ms` }}
                />

                <FileChip done={phase === "done"} />

                <div className="absolute inset-x-0 bottom-4 flex justify-center px-4 md:bottom-6">
                    <Toolbar phase={phase} onRun={run} onReset={reset} onCompare={compare} />
                </div>
            </div>
            <figcaption className="mt-5 text-center text-sm text-quaternary">
                <span className="hidden [@media(hover:hover)]:inline">Hover to preview. </span>A live demo on a sample photo.
            </figcaption>
        </figure>
    );
}

function FileChip({ done }: { done: boolean }) {
    return (
        <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-neutral-950/45 px-3 py-1 font-mono text-xs text-white backdrop-blur-md md:top-6 md:left-6">
            kingfisher.{done ? "png" : "jpg"}
        </span>
    );
}

interface ToolbarProps {
    phase: Phase;
    onRun: () => void;
    onReset: () => void;
    onCompare: (showOriginal: boolean) => void;
}

const pill = "press-scale rounded-full before:rounded-full";

function Toolbar({ phase, onRun, onReset, onCompare }: ToolbarProps) {
    return (
        <div
            className="material flex items-center gap-1 rounded-full p-1.5"
        >
            {phase === "idle" && (
                <Button key="run" size="lg" color="primary" iconLeading={Eraser} onPress={onRun} className={cn(pill, "animate-enter [--i:-1]")}>
                    Remove background
                </Button>
            )}

            {phase === "processing" && (
                <p key="processing" role="status" className="animate-enter flex h-11 items-center gap-2.5 px-5 text-md font-medium text-secondary [--i:-1]">
                    <span className="size-1.5 animate-pulse rounded-full bg-fg-primary" aria-hidden />
                    Removing background…
                </p>
            )}

            {phase === "done" && (
                <div key="done" className="animate-enter flex items-center gap-1 [--i:-1]">
                    <Button
                        size="lg"
                        color="tertiary"
                        onPressStart={() => onCompare(true)}
                        onPressEnd={() => onCompare(false)}
                        className={pill}
                    >
                        Hold to compare
                    </Button>
                    <Button
                        size="lg"
                        color="tertiary"
                        iconLeading={RotateCcw}
                        aria-label="Start over"
                        onPress={onReset}
                        className={pill}
                    />
                    <Button
                        size="lg"
                        color="primary"
                        iconLeading={Download}
                        href={KINGFISHER_CUTOUT_PNG}
                        download="kingfisher-cutout.png"
                        className={pill}
                    >
                        Download
                    </Button>
                </div>
            )}

            <span className="sr-only" role="status">
                {phase === "done" ? "Background removed. The result is ready to download." : ""}
            </span>
        </div>
    );
}
