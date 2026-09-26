import { Eraser, Paintbrush, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/base/buttons/button";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import type { BrushSettings } from "./EditorCanvas";
import type { BrushMode } from "./document";

interface RefinePanelProps {
    brush: BrushSettings;
    onBrushChange: (brush: BrushSettings) => void;
    /** Brush sizes are image pixels, so the range follows the photo. */
    maxSize: number;
    strokeCount: number;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onResetMask: () => void;
}

/** Hand corrections for what the model got wrong: take more away, or paint the real photo back. */
export function RefinePanel({ brush, onBrushChange, maxSize, strokeCount, canUndo, canRedo, onUndo, onRedo, onResetMask }: RefinePanelProps) {
    const t = useT();
    const copy = t.bgEditor;
    const set = (patch: Partial<BrushSettings>) => onBrushChange({ ...brush, ...patch });

    const modes: { id: BrushMode; icon: typeof Eraser; label: string; hint: string; key: string }[] = [
        { id: "erase", icon: Eraser, label: copy.erase, hint: copy.eraseHint, key: "E" },
        { id: "restore", icon: Paintbrush, label: copy.restore, hint: copy.restoreHint, key: "R" },
    ];

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-sm font-semibold text-primary">{copy.refineTitle}</h3>
                <p className="mt-0.5 text-xs text-tertiary">{copy.refineHint}</p>
            </div>

            <div role="radiogroup" aria-label={copy.brushMode} className="grid grid-cols-2 gap-2">
                {modes.map(({ id, icon: Icon, label, hint, key }) => (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={brush.mode === id}
                        onClick={() => set({ mode: id })}
                        title={`${label} (${key})`}
                        className={cn(
                            "flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors duration-150 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                            brush.mode === id ? "border-[var(--tool)] bg-[var(--tool-soft)]" : "border-[var(--card-line)] hover:border-[var(--tool-line)]",
                        )}
                    >
                        <span className="flex w-full items-center justify-between">
                            <Icon className={cn("size-4", brush.mode === id ? "text-[var(--tool)]" : "text-tertiary")} aria-hidden />
                            <kbd className="rounded border border-[var(--card-line)] px-1 font-sans text-[0.625rem] text-quaternary">{key}</kbd>
                        </span>
                        <span className="text-sm font-semibold text-primary">{label}</span>
                        <span className="text-xs leading-snug text-tertiary">{hint}</span>
                    </button>
                ))}
            </div>

            <div className="flex flex-col gap-4">
                <Range label={copy.brushSize} value={Math.round(brush.size)} min={2} max={maxSize} onChange={(size) => set({ size })} format={(value) => `${value}px`} hint="[ ]" />
                <Range label={copy.softness} value={Math.round(brush.softness * 100)} min={0} max={100} onChange={(value) => set({ softness: value / 100 })} format={(value) => `${value}%`} />
                <Range label={copy.opacity} value={Math.round(brush.opacity * 100)} min={10} max={100} onChange={(value) => set({ opacity: value / 100 })} format={(value) => `${value}%`} />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--card-line)] pt-4">
                <Button size="sm" color="secondary" iconLeading={Undo2} onPress={onUndo} isDisabled={!canUndo} className="press-scale pointer-coarse:min-h-11">
                    {copy.undo}
                </Button>
                <Button size="sm" color="secondary" iconLeading={Redo2} onPress={onRedo} isDisabled={!canRedo} className="press-scale pointer-coarse:min-h-11">
                    {copy.redo}
                </Button>
                <Button size="sm" color="tertiary" iconLeading={RotateCcw} onPress={onResetMask} isDisabled={strokeCount === 0} className="press-scale pointer-coarse:min-h-11">
                    {copy.resetMask}
                </Button>
            </div>
            <p className="text-xs text-quaternary">{strokeCount > 0 ? copy.strokeCount(strokeCount) : copy.zoomTip}</p>
        </div>
    );
}

export function Range({ label, value, min, max, onChange, format, hint }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; format: (value: number) => string; hint?: string }) {
    const id = useId();
    return (
        <div>
            <label htmlFor={id} className="flex items-center justify-between text-xs font-medium text-secondary">
                <span>
                    {label}
                    {hint && <kbd className="ml-1.5 rounded border border-[var(--card-line)] px-1 font-sans text-[0.625rem] text-quaternary">{hint}</kbd>}
                </span>
                <span className="text-tertiary tabular-nums">{format(value)}</span>
            </label>
            <input id={id} type="range" min={min} max={max} value={Math.min(max, value)} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-[var(--tool-solid)] pointer-coarse:h-8" />
        </div>
    );
}

/** The short version under the background options: the two brushes, their size and edge, and a reset. */
export function RefineCard({ brush, onBrushChange, maxSize, strokeCount, onResetMask }: Pick<RefinePanelProps, "brush" | "onBrushChange" | "maxSize" | "strokeCount" | "onResetMask">) {
    const t = useT();
    const copy = t.bgEditor;
    const set = (patch: Partial<BrushSettings>) => onBrushChange({ ...brush, ...patch });
    return (
        <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-primary">
                {copy.refine} <span className="font-normal text-tertiary">({copy.optional})</span>
            </h3>
            <div role="radiogroup" aria-label={copy.brushMode} className="grid grid-cols-2 gap-2">
                {(
                    [
                        ["erase", Eraser, copy.erase],
                        ["restore", Paintbrush, copy.restore],
                    ] as const
                ).map(([id, Icon, label]) => (
                    <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={brush.mode === id}
                        onClick={() => set({ mode: id })}
                        className={cn(
                            "flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:h-11",
                            brush.mode === id ? "border-[var(--tool)] bg-[var(--tool-soft)] text-[var(--tool)]" : "border-transparent bg-secondary text-secondary hover:text-primary",
                        )}
                    >
                        <Icon className="size-4" aria-hidden />
                        {label}
                    </button>
                ))}
            </div>
            <Range label={copy.brushSize} value={Math.round(brush.size)} min={2} max={maxSize} onChange={(size) => set({ size })} format={(value) => `${value}px`} />
            <Range label={copy.softness} value={Math.round(brush.softness * 100)} min={0} max={100} onChange={(value) => set({ softness: value / 100 })} format={(value) => `${value}%`} />
            <Button size="md" color="secondary" iconLeading={RotateCcw} onPress={onResetMask} isDisabled={strokeCount === 0} className="press-scale w-full pointer-coarse:min-h-11">
                {copy.resetMask}
            </Button>
        </section>
    );
}
