import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/base/buttons/button";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { type BrushOptions, type RetouchTool, TOOL_ICONS, TOOL_KEYS } from "./modes";

interface BrushSettingsProps {
    tool: RetouchTool;
    onToolChange: (tool: RetouchTool) => void;
    brush: BrushOptions;
    onBrushChange: (brush: BrushOptions) => void;
    /** Brush sizes are image pixels, so the range follows the photo. */
    maxSize: number;
    /** e.g. "12% of the image selected", or null when nothing is. */
    coverage: string | null;
    onClear: () => void;
    disabled?: boolean;
}

/** "Select area": paint or erase the selection, with the brush's size, edge and strength. */
export function BrushSettings({ tool, onToolChange, brush, onBrushChange, maxSize, coverage, onClear, disabled }: BrushSettingsProps) {
    const t = useT();
    const copy = t.retouch;
    const set = (patch: Partial<BrushOptions>) => onBrushChange({ ...brush, ...patch });
    const labels: Record<RetouchTool, string> = { paint: copy.paint, erase: copy.erase, move: copy.move };

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h3 className="text-sm font-semibold text-primary">{copy.selectTitle}</h3>
                <p className="mt-0.5 text-xs text-tertiary">{copy.selectHint}</p>
            </div>

            <div role="radiogroup" aria-label={copy.tools} className="grid grid-cols-3 gap-1.5">
                {(Object.keys(TOOL_ICONS) as RetouchTool[]).map((id) => {
                    const Icon = TOOL_ICONS[id];
                    const selected = tool === id;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled && id !== "move"}
                            onClick={() => onToolChange(id)}
                            title={`${labels[id]} (${TOOL_KEYS[id]})`}
                            className={cn(
                                "flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-11",
                                selected ? "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--card-line)] text-secondary hover:bg-secondary hover:text-primary",
                            )}
                        >
                            <Icon className="size-4" aria-hidden />
                            {labels[id]}
                        </button>
                    );
                })}
            </div>

            <fieldset disabled={disabled} className="flex flex-col gap-4 disabled:opacity-50">
                <Range label={copy.brushSize} value={Math.round(brush.size)} min={2} max={maxSize} onChange={(size) => set({ size })} format={(value) => `${value}px`} hint="[ ]" />
                <Range label={copy.softness} value={Math.round(brush.softness * 100)} min={0} max={100} onChange={(value) => set({ softness: value / 100 })} format={(value) => `${value}%`} />
                <Range label={copy.opacity} value={Math.round(brush.opacity * 100)} min={10} max={100} onChange={(value) => set({ opacity: value / 100 })} format={(value) => `${value}%`} />
            </fieldset>

            <div className="flex items-center justify-between gap-3 border-t border-[var(--card-line)] pt-4">
                <p className="min-w-0 truncate text-xs text-quaternary tabular-nums">{coverage ?? copy.notices.start}</p>
                <Button size="sm" color="tertiary" iconLeading={Trash2} onPress={onClear} isDisabled={disabled || !coverage} className="press-scale shrink-0 pointer-coarse:min-h-11">
                    {copy.clearSelection}
                </Button>
            </div>
        </section>
    );
}
