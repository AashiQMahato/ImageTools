import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import type { CompressSettings, OutputFormat, QualityPreset } from "@/lib/api/compressApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { PRESET_QUALITY } from "./settings";

const PRESETS: readonly QualityPreset[] = ["maximum", "high", "balanced", "small", "minimum"];
const TARGETS: readonly { size: number; unit: "KB" | "MB" }[] = [
    { size: 100, unit: "KB" },
    { size: 200, unit: "KB" },
    { size: 500, unit: "KB" },
    { size: 1, unit: "MB" },
    { size: 2, unit: "MB" },
    { size: 5, unit: "MB" },
];
const SIDES = [3840, 2560, 1920, 1280, 1024, 800] as const;

interface CompressionSettingsProps {
    settings: CompressSettings;
    onChange: (settings: CompressSettings) => void;
    /** Some image may have transparency, so a JPG choice needs its warning. */
    mayHaveAlpha: boolean;
    disabled?: boolean;
}

/** Plain choices first (how small, or how big a file you need); the technical ones fold away. */
export function CompressionSettings({ settings, onChange, mayHaveAlpha, disabled }: CompressionSettingsProps) {
    const t = useT();
    const copy = t.compress;
    const set = (patch: Partial<CompressSettings>) => onChange({ ...settings, ...patch });
    const sizeId = useId();
    const unitId = useId();
    const resizeId = useId();
    const control = "h-10 rounded-lg border border-[var(--card-line)] bg-primary px-3 text-sm text-primary outline-focus-ring focus-visible:outline-2 disabled:opacity-50 pointer-coarse:h-11";

    return (
        <fieldset disabled={disabled} className="flex flex-col gap-6">
            <section>
                <h3 className="text-sm font-semibold text-primary">{copy.levelTitle}</h3>
                <div role="radiogroup" aria-label={copy.levelTitle} className="mt-3 flex flex-col gap-1">
                    {PRESETS.map((id) => {
                        const selected = settings.preset === id;
                        return (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => set({ preset: id, quality: null })}
                                className={cn(
                                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-150 outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed pointer-coarse:py-3",
                                    selected ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-transparent hover:bg-secondary",
                                )}
                            >
                                <span className="min-w-0">
                                    <span className={cn("block text-sm font-semibold", selected ? "text-[var(--brand)]" : "text-primary")}>{copy.presets[id].label}</span>
                                    <span className="block truncate text-xs text-tertiary">{copy.presets[id].hint}</span>
                                </span>
                                <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-full border-2", selected ? "border-[var(--brand)]" : "border-[var(--card-line)]")}>
                                    {selected && <span className="size-1.5 rounded-full bg-[var(--brand)]" />}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section>
                <h3 className="text-sm font-semibold text-primary">{copy.targetTitle}</h3>
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-secondary">
                    <input type="checkbox" checked={settings.target !== null} onChange={(event) => set({ target: event.target.checked ? { size: 500, unit: "KB" } : null })} className="size-4 accent-[var(--brand)]" />
                    {copy.targetToggle}
                </label>
                {settings.target && (
                    <div className="animate-enter mt-3 flex flex-col gap-3 [--i:-1]">
                        <div className="flex gap-2">
                            <label htmlFor={sizeId} className="sr-only">
                                {copy.targetValue}
                            </label>
                            <input
                                id={sizeId}
                                type="number"
                                inputMode="decimal"
                                min={settings.target.unit === "MB" ? 0.05 : 5}
                                step={settings.target.unit === "MB" ? 0.1 : 10}
                                value={settings.target.size}
                                onChange={(event) => set({ target: { ...settings.target!, size: Math.max(0.01, Number(event.target.value) || 0) } })}
                                className={cn(control, "min-w-0 flex-1 tabular-nums")}
                            />
                            <label htmlFor={unitId} className="sr-only">
                                {copy.targetUnit}
                            </label>
                            <select id={unitId} value={settings.target.unit} onChange={(event) => set({ target: { ...settings.target!, unit: event.target.value as "KB" | "MB" } })} className={control}>
                                <option value="KB">KB</option>
                                <option value="MB">MB</option>
                            </select>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {TARGETS.map((target) => {
                                const active = settings.target?.size === target.size && settings.target.unit === target.unit;
                                return (
                                    <button
                                        key={`${target.size}${target.unit}`}
                                        type="button"
                                        onClick={() => set({ target })}
                                        aria-pressed={active}
                                        className={cn(
                                            "h-8 cursor-pointer rounded-full border px-3 text-xs font-medium tabular-nums transition-colors duration-150 outline-focus-ring focus-visible:outline-2 pointer-coarse:h-10",
                                            active ? "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--card-line)] text-secondary hover:bg-secondary",
                                        )}
                                    >
                                        {target.size} {target.unit}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-quaternary">{copy.targetHint}</p>
                    </div>
                )}
            </section>

            <details className="group rounded-xl border border-[var(--card-line)]">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-sm font-semibold text-primary outline-focus-ring focus-visible:outline-2 [&::-webkit-details-marker]:hidden">
                    {copy.advanced}
                    <ChevronDown className="size-4 text-quaternary transition-transform duration-200 group-open:rotate-180" aria-hidden />
                </summary>
                <div className="flex flex-col gap-5 border-t border-[var(--card-line)] p-3">
                    <div>
                        <Range
                            label={copy.quality}
                            value={settings.quality ?? PRESET_QUALITY[settings.preset]}
                            min={10}
                            max={100}
                            onChange={(quality) => set({ quality })}
                            format={(value) => (settings.quality === null ? `${value} · ${copy.qualityAuto}` : String(value))}
                        />
                        {settings.quality !== null && (
                            <button type="button" onClick={() => set({ quality: null })} className="mt-1.5 cursor-pointer text-xs font-medium text-[var(--brand)] outline-focus-ring hover:underline focus-visible:outline-2">
                                {copy.qualityReset}
                            </button>
                        )}
                    </div>
                    <div>
                        <p className="mb-2 text-xs font-medium text-secondary">{copy.format}</p>
                        <Segmented
                            label={copy.format}
                            value={settings.format}
                            onChange={(format: OutputFormat) => set({ format })}
                            className="w-full [&>button]:flex-1"
                            options={(["auto", "jpeg", "png", "webp"] as const).map((value) => ({ value, label: copy.formats[value] }))}
                        />
                        <p role={settings.format === "jpeg" && mayHaveAlpha ? "note" : undefined} className={cn("mt-2 text-xs", settings.format === "jpeg" && mayHaveAlpha ? "text-warning-primary" : "text-quaternary")}>
                            {settings.format === "jpeg" && mayHaveAlpha ? copy.jpegAlpha : settings.format === "auto" ? copy.formatAuto : null}
                        </p>
                    </div>
                    <div>
                        <label htmlFor={resizeId} className="mb-2 block text-xs font-medium text-secondary">
                            {copy.resize}
                        </label>
                        <select id={resizeId} value={settings.maxSide ?? ""} onChange={(event) => set({ maxSide: event.target.value ? Number(event.target.value) : null })} className={cn(control, "w-full")}>
                            <option value="">{copy.resizeOriginal}</option>
                            {SIDES.map((side) => (
                                <option key={side} value={side}>
                                    {copy.resizeTo(side)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-secondary">
                        <input type="checkbox" checked={settings.stripMetadata} onChange={(event) => set({ stripMetadata: event.target.checked })} className="size-4 accent-[var(--brand)]" />
                        {copy.stripMetadata}
                    </label>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-secondary">
                        <input type="checkbox" checked={settings.progressive} onChange={(event) => set({ progressive: event.target.checked })} className="size-4 accent-[var(--brand)]" />
                        {copy.progressive}
                    </label>
                </div>
            </details>
        </fieldset>
    );
}
