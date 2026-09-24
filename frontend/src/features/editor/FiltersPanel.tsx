import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { applyMatrix, buildMatrix, FILTERS, type FilterId, NEUTRAL_ADJUSTMENTS } from "./color";
import { useT } from "@/i18n";

interface FiltersPanelProps {
    /** A small copy of the photo to preview each look on. */
    thumbnail: ImageData | null;
    value: FilterId;
    onSelect: (filter: FilterId) => void;
}

/** Each look previewed on the actual photo. */
export function FiltersPanel({ thumbnail, value, onSelect }: FiltersPanelProps) {
    const t = useT();
    return (
        <div role="radiogroup" aria-label={t.editor.filters.label} className="grid grid-cols-4 gap-3 lg:grid-cols-2">
            {FILTERS.map((filter) => {
                const checked = filter.id === value;
                return (
                    <button
                        key={filter.id}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onSelect(filter.id)}
                        className="group flex cursor-pointer flex-col items-center gap-2 rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                        <span
                            className={cn(
                                "relative block aspect-square w-full overflow-hidden rounded-xl transition-[box-shadow,scale] duration-300 ease-[var(--ease-spring)] group-active:scale-95",
                                checked ? "shadow-[0_0_0_2px_var(--color-fg-primary)]" : "shadow-[0_0_0_1px_rgb(255_255_255/0.08)]",
                            )}
                        >
                            <FilterThumb thumbnail={thumbnail} filter={filter.id} />
                        </span>
                        <span className={cn("text-xs font-medium transition-colors", checked ? "text-primary" : "text-tertiary")}>{t.editor.filters[filter.id]}</span>
                    </button>
                );
            })}
        </div>
    );
}

function FilterThumb({ thumbnail, filter }: { thumbnail: ImageData | null; filter: FilterId }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const canvas = ref.current;
        if (!canvas || !thumbnail) return;
        canvas.width = thumbnail.width;
        canvas.height = thumbnail.height;
        const copy = new ImageData(new Uint8ClampedArray(thumbnail.data), thumbnail.width, thumbnail.height);
        const matrix = buildMatrix(filter, NEUTRAL_ADJUSTMENTS);
        if (matrix) applyMatrix(copy.data, matrix);
        canvas.getContext("2d")?.putImageData(copy, 0, 0);
    }, [thumbnail, filter]);
    return <canvas ref={ref} aria-hidden className="size-full bg-tertiary object-cover" />;
}
