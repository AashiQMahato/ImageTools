import { useImageStore } from "@/store/useImageStore";
import type { UpscaleFactor } from "@/types/image";
import { cn } from "@/lib/utils/cn";

const SCALES: readonly UpscaleFactor[] = [2, 4];

export function ScalePicker({ disabledScales = [] }: { disabledScales?: readonly UpscaleFactor[] }) {
    const scale = useImageStore((state) => state.selectedScale);
    const setScale = useImageStore((state) => state.setSelectedScale);

    return (
        <div role="radiogroup" aria-label="Upscale factor" className="mx-1 flex rounded-full bg-secondary p-1 dark:bg-tertiary">
            {SCALES.map((option) => {
                const disabled = disabledScales.includes(option);
                return (
                    <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={scale === option}
                        disabled={disabled}
                        title={disabled ? "Too large to upscale this much" : undefined}
                        onClick={() => setScale(option)}
                        className={cn(
                            "min-h-9 min-w-12 cursor-pointer rounded-full px-3 text-sm font-semibold tabular-nums transition-[color,background-color,box-shadow] duration-200",
                            "outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40",
                            scale === option ? "bg-primary text-primary shadow-xs" : "text-tertiary hover:text-primary",
                        )}
                    >
                        {option}×
                    </button>
                );
            })}
        </div>
    );
}
