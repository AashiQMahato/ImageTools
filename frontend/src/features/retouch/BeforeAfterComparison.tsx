import { useEffect, useState } from "react";
import { CompareSlider } from "@/components/common/CompareSlider";
import { Segmented } from "@/components/common/Segmented";
import { Fitted } from "@/components/studio/StudioParts";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import type { ImageDimensions } from "@/types/image";
import { useT } from "@/i18n";

export type CompareMode = "slider" | "split" | "toggle";

interface Side {
    src: string;
    alt: string;
    label: string;
}

const imageClass = "absolute inset-0 size-full object-contain";

/**
 * The comparison drawn over the image (inside the zoomable frame): a draggable divider, or the two
 * versions swapped in place. The slider opens with a short sweep from the result to the middle, so
 * the change is the first thing you see.
 */
export function ComparisonLayer({ mode, before, after, showBefore }: { mode: Exclude<CompareMode, "split">; before: Side; after: Side; showBefore: boolean }) {
    const reduced = usePrefersReducedMotion();
    const [position, setPosition] = useState(reduced ? 50 : 0);

    useEffect(() => {
        if (mode !== "slider" || reduced) return;
        let frame = 0;
        const started = performance.now();
        const step = (now: number) => {
            const progress = Math.min(1, (now - started) / 750);
            setPosition(50 * (1 - (1 - progress) ** 3));
            if (progress < 1) frame = requestAnimationFrame(step);
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, [mode, reduced]);

    if (mode === "slider") {
        return (
            <CompareSlider
                value={position}
                onChange={setPosition}
                beforeLabel={before.label}
                afterLabel={after.label}
                className="retouch-fade-in absolute inset-0 size-full"
                before={<img src={before.src} alt={before.alt} className={imageClass} draggable={false} />}
                after={<img src={after.src} alt={after.alt} className={imageClass} draggable={false} />}
            />
        );
    }
    return (
        <div className="retouch-fade-in absolute inset-0">
            <img src={after.src} alt={after.alt} className={imageClass} draggable={false} />
            <img src={before.src} alt={before.alt} aria-hidden={!showBefore} className={cn(imageClass, "transition-opacity duration-300 ease-[var(--ease-out)]", showBefore ? "opacity-100" : "opacity-0")} draggable={false} />
            <span aria-live="polite" className="pointer-events-none absolute top-4 left-4 rounded-full bg-neutral-950/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                {showBefore ? before.label : after.label}
            </span>
        </div>
    );
}

/** Both versions next to each other, each as large as its half allows (stacked on tall, narrow screens). */
export function SideBySide({ before, after, dimensions }: { before: Side; after: Side; dimensions: ImageDimensions }) {
    const [narrow, setNarrow] = useState(() => window.matchMedia("(max-aspect-ratio: 1/1)").matches);
    useEffect(() => {
        const media = window.matchMedia("(max-aspect-ratio: 1/1)");
        const onChange = () => setNarrow(media.matches);
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);
    return (
        <div className={cn("retouch-fade-in flex min-h-0 flex-1", narrow ? "flex-col" : "flex-row")}>
            {[before, after].map((side) => (
                <div key={side.label} className="relative flex min-h-0 min-w-0 flex-1">
                    <Fitted dimensions={dimensions}>
                        {(size) => (
                            <figure className="relative overflow-hidden rounded-lg" style={size}>
                                <img src={side.src} alt={side.alt} className={imageClass} draggable={false} />
                                <figcaption className="pointer-events-none absolute top-3 left-3 rounded-full bg-neutral-950/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">{side.label}</figcaption>
                            </figure>
                        )}
                    </Fitted>
                </div>
            ))}
        </div>
    );
}

/** How to compare, and — when toggling — which version is showing. Floats over the top of the canvas. */
export function CompareControls({ mode, onModeChange, showBefore, onShowBeforeChange }: { mode: CompareMode; onModeChange: (mode: CompareMode) => void; showBefore: boolean; onShowBeforeChange: (value: boolean) => void }) {
    const t = useT();
    const copy = t.retouch;
    return (
        <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="material rounded-full p-0.5">
                <Segmented
                    size="sm"
                    label={copy.compareLabel}
                    value={mode}
                    onChange={onModeChange}
                    options={(["slider", "split", "toggle"] as const).map((value) => ({ value, label: copy.compareModes[value] }))}
                />
            </div>
            {mode === "toggle" && (
                <div className="material animate-enter rounded-full p-0.5 [--i:-1]">
                    <Segmented
                        size="sm"
                        label={copy.showing}
                        value={showBefore ? "before" : "after"}
                        onChange={(value) => onShowBeforeChange(value === "before")}
                        options={[
                            { value: "before", label: copy.before },
                            { value: "after", label: copy.after },
                        ]}
                    />
                </div>
            )}
        </div>
    );
}
