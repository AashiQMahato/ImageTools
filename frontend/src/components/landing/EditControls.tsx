import { SlidersHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

interface Row {
    key: "brightness" | "contrast" | "saturation";
    /** Static value, -100…100 like the editor's own sliders. Saturation is animated instead. */
    value?: number;
}

const ROWS: readonly Row[] = [
    { key: "brightness", value: 8 },
    { key: "contrast", value: 12 },
    { key: "saturation" },
];

/**
 * A floating slice of the real editor. During the edit moment the saturation row lights up and its
 * value climbs — the same grade the centre piece receives, so the card explains the change.
 * Decorative: the editor itself is one click away.
 */
export function EditControls({ className }: { className?: string }) {
    const t = useT();

    return (
        <div aria-hidden className={cn("hero-nudge absolute", className)} style={{ "--nudge-x": "-6px", "--nudge-y": "0px" } as CSSProperties}>
            <div className="hero-float" style={{ "--float": "hero-float-y", "--float-duration": "8s", "--float-delay": "2.2s" } as CSSProperties}>
                <div className="hero-timeline hero-sat rounded-xl border border-secondary bg-primary p-2.5 shadow-xl">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <SlidersHorizontal className="size-3.5 text-[var(--brand)]" />
                        {t.editor.tabs.adjust}
                    </p>

                    <div className="mt-1.5 grid gap-1">
                        {ROWS.map((row) => {
                            const animated = row.value === undefined;
                            return (
                                <div key={row.key} className="relative -mx-1.5 rounded-md px-1.5 py-0.5">
                                    {animated && <span className="hero-timeline hero-row-active absolute inset-0 rounded-md bg-secondary" />}
                                    <div className="relative flex items-baseline justify-between gap-2 text-[0.6875rem] leading-4">
                                        <span className="truncate text-tertiary">{t.editor.adjust[row.key]}</span>
                                        {animated ? (
                                            <span className="hero-sat-value font-medium text-primary tabular-nums" />
                                        ) : (
                                            <span className="font-medium text-primary tabular-nums">{row.value}</span>
                                        )}
                                    </div>
                                    <div className="relative mt-1.5 h-1 rounded-full bg-tertiary">
                                        {/* Fill grows from the centre (zero) by scale, never by width. */}
                                        <span
                                            className="absolute inset-y-0 left-1/2 w-1/2 origin-left rounded-full bg-brand-solid"
                                            style={{ scale: animated ? "calc(var(--hero-sat) / 100) 1" : `${row.value! / 100} 1` }}
                                        />
                                        {/* Thumb rides a track-wide layer, so its offset is a percentage of the track. */}
                                        <span
                                            className={cn("absolute inset-y-0 left-1/2 flex w-full items-center", animated && "hero-sat-thumb")}
                                            style={animated ? undefined : { translate: `${row.value! * 0.5}% 0` }}
                                        >
                                            <span className="-ml-1.5 size-3 rounded-full border border-secondary bg-primary shadow-sm" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
