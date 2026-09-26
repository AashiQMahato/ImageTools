import { IdCard, type LucideIcon, Plane } from "lucide-react";
import type { PhotoPreset } from "@/lib/api/photoGeneratorApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { formatSize } from "./labels";

const ICONS: Record<string, LucideIcon> = { passport: Plane, mrp: IdCard };

/** The photo types, as the server defines them — a new preset there appears here with no change. */
export function PresetSelector({ presets, value, onChange, disabled }: { presets: readonly PhotoPreset[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
    const t = useT();
    const copy = t.photo;
    return (
        <section>
            <h3 className="text-sm font-semibold text-primary">{copy.typeTitle}</h3>
            <div role="radiogroup" aria-label={copy.typeTitle} className="mt-3 grid grid-cols-2 gap-2">
                {presets.map((preset) => {
                    const Icon = ICONS[preset.id] ?? IdCard;
                    const selected = preset.id === value;
                    return (
                        <button
                            key={preset.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            onClick={() => onChange(preset.id)}
                            className={cn(
                                "flex cursor-pointer flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors duration-150 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:p-4",
                                selected ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--card-line)] hover:bg-secondary",
                            )}
                        >
                            <Icon className={cn("size-5", selected ? "text-[var(--brand)]" : "text-tertiary")} aria-hidden />
                            <span className={cn("text-sm font-semibold", selected ? "text-[var(--brand)]" : "text-primary")}>{copy.presetNames[preset.id] ?? preset.name}</span>
                            <span className="text-xs text-tertiary tabular-nums">{copy.spec(formatSize(preset.size), preset.dpi)}</span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

/** What the chosen type produces, in plain terms — no one has to know what DPI means to read it. */
export function OutputSpecs({ preset }: { preset: PhotoPreset }) {
    const t = useT();
    const copy = t.photo;
    const rows: [string, string][] = [
        [copy.output.size, formatSize(preset.size)],
        [copy.output.resolution, `${preset.dpi} DPI`],
        [copy.output.pixels, copy.pixels(preset.width, preset.height)],
        [copy.output.format, "JPEG"],
        [copy.output.background, copy.output.white],
    ];
    return (
        <section>
            <h3 className="mb-2 text-sm font-semibold text-primary">{copy.outputTitle}</h3>
            <dl className="divide-y divide-[var(--card-line)] rounded-xl border border-[var(--card-line)] px-3 text-sm">
                {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between py-2.5">
                        <dt className="text-tertiary">{label}</dt>
                        <dd className="font-medium text-primary tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>
            <p className="mt-2 text-xs text-quaternary">{copy.autoNote}</p>
        </section>
    );
}
