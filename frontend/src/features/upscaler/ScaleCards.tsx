import { Check } from "lucide-react";
import { type KeyboardEvent, useRef } from "react";
import { formatDimensions } from "@/features/image-processing/format";
import { useImageStore } from "@/store/useImageStore";
import type { ImageDimensions, UpscaleFactor } from "@/types/image";
import { useT } from "@/i18n";
import { SCALES, targetSize } from "./scale";

interface ScaleCardsProps {
    /** Scales whose output would exceed the API's pixel ceiling for this image. */
    disabledScales: readonly UpscaleFactor[];
    /** Scales this server reports it can run, from /health/processors. */
    availableScales?: readonly UpscaleFactor[];
    /** The image being upscaled (the tool's own, not the shared one, which may already be a result). */
    dimensions: ImageDimensions | null;
}

/**
 * Scale choice as a radio group of tiles rather than a segmented control: each option carries its own
 * output size and, when it can't be used, the reason — neither of which fits in a segment.
 */
export function ScaleCards({ disabledScales, availableScales, dimensions }: ScaleCardsProps) {
    const t = useT();
    const scale = useImageStore((state) => state.selectedScale);
    const setScale = useImageStore((state) => state.setSelectedScale);
    const groupRef = useRef<HTMLDivElement>(null);

    const reasonFor = (option: UpscaleFactor) => {
        if (availableScales && !availableScales.includes(option)) return t.pages.upscale.notOnServer;
        if (disabledScales.includes(option)) return t.pages.upscale.tooLargeFor;
        return null;
    };

    const selectable = SCALES.filter((option) => !reasonFor(option));
    // Exactly one tile is in the tab order (radio-group convention); arrows move within it.
    const focusable = selectable.includes(scale) ? scale : selectable[0];

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key) || selectable.length < 2) return;
        event.preventDefault();
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        const next = selectable[(Math.max(0, selectable.indexOf(scale)) + step + selectable.length) % selectable.length];
        if (!next) return;
        setScale(next);
        groupRef.current?.querySelector<HTMLButtonElement>(`[data-scale="${next}"]`)?.focus();
    };

    return (
        <section>
            <h3 id="scale-label" className="text-label text-quaternary">
                {t.pages.upscale.factor}
            </h3>
            <div ref={groupRef} role="radiogroup" aria-labelledby="scale-label" onKeyDown={onKeyDown} className="mt-2 grid grid-cols-2 gap-2.5">
                {SCALES.map((option) => {
                    const reason = reasonFor(option);
                    const output = dimensions ? targetSize(dimensions, option) : null;
                    return (
                        <button
                            key={option}
                            type="button"
                            role="radio"
                            data-scale={option}
                            aria-checked={scale === option}
                            disabled={Boolean(reason)}
                            tabIndex={option === focusable ? 0 : -1}
                            onClick={() => setScale(option)}
                            className="option-card flex-col items-start gap-0.5"
                        >
                            <span className="flex w-full items-center justify-between">
                                <span className="text-lg font-semibold tracking-[-0.01em] text-primary tabular-nums">{option}×</span>
                                {scale === option && <Check className="size-4 text-[var(--tool)]" aria-hidden />}
                            </span>
                            <span className="text-xs font-medium text-secondary">{t.pages.upscale.scaleNote[option]}</span>
                            <span className="text-xs text-quaternary tabular-nums">{reason ?? (output ? formatDimensions(output) : t.pages.upscale.noImageYet)}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
