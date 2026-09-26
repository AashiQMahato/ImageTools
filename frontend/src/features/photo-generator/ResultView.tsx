import { ArrowRight, Check, CircleAlert, X } from "lucide-react";
import { useState } from "react";
import { Fitted } from "@/components/studio/StudioParts";
import { apiUrl, type GeneratedPhoto } from "@/lib/api/photoGeneratorApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { formatSize, presetName } from "./labels";
import type { Preview } from "./usePhotoJob";

/** The finished photo, shown like a print, with exactly what it is underneath. */
export function ResultView({ result, previews, src }: { result: GeneratedPhoto; previews: Partial<Record<"original" | "cutout" | "white", Preview>>; src: string }) {
    const t = useT();
    const copy = t.photo;
    const stages = (["original", "cutout", "white"] as const).filter((key) => previews[key]);
    /** A source that failed to load (e.g. a server copy that has expired) stays hidden until the next one. */
    const [failed, setFailed] = useState<string | null>(null);
    return (
        <div className="retouch-fade-in flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
                <Fitted dimensions={result}>
                    {(size) => (
                        <figure className="relative bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08),0_18px_40px_-18px_rgb(0_0_0/0.45)] ring-1 ring-black/5" style={size}>
                            {/* Keyed on the source, so an adjusted crop fades in rather than snapping. */}
                            <img key={src} src={src} alt={presetName(t, result.preset)} onError={() => setFailed(src)} className={cn("retouch-fade-in size-full", failed === src && "invisible")} draggable={false} />
                        </figure>
                    )}
                </Fitted>
            </div>
            <div className="flex flex-col items-center gap-3 px-3 pb-3">
                <p className="text-center">
                    <span className="block text-sm font-semibold text-primary">{presetName(t, result.preset)}</span>
                    <span className="mt-0.5 block text-xs text-tertiary tabular-nums">
                        {formatSize(result.size)} · {result.dpi} DPI · {copy.pixels(result.width, result.height)} · JPEG
                    </span>
                </p>
                {stages.length > 1 && (
                    <ol aria-label={copy.preparing} className="flex items-center gap-1.5 sm:gap-2">
                        {stages.map((key, index) => (
                            <li key={key} className="flex items-center gap-1.5 sm:gap-2">
                                {index > 0 && <ArrowRight className="size-3.5 shrink-0 text-quaternary" aria-hidden />}
                                <figure className="flex flex-col items-center gap-1">
                                    <img src={apiUrl(previews[key]!.url)} alt="" className={cn("h-12 rounded-md object-cover ring-1 ring-[var(--card-line)] sm:h-14", key === "cutout" && "bg-checkerboard")} draggable={false} />
                                    <figcaption className="text-[0.6875rem] text-tertiary">{copy.stages[key]}</figcaption>
                                </figure>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </div>
    );
}

/** Ready or not, and why: every check the finished file passed, with how to fix any that failed. */
export function QualityPanel({ result }: { result: GeneratedPhoto }) {
    const t = useT();
    const copy = t.photo;
    const { ready, checks } = result.quality;
    return (
        <section className="flex flex-col gap-4">
            <div className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold", ready ? "bg-success-primary text-success-primary" : "bg-warning-primary text-warning-primary")}>
                {ready ? <Check className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
                {ready ? copy.ready : copy.needsAdjustment}
            </div>
            <div>
                <h3 className="mb-2 text-sm font-semibold text-primary">{copy.checksTitle}</h3>
                <ul className="flex flex-col gap-1.5">
                    {checks.map(({ id, ok }) => (
                        <li key={id} className="flex gap-2 text-sm">
                            {ok ? <Check className="mt-0.5 size-4 shrink-0 text-success-primary" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-warning-primary" aria-hidden />}
                            <span>
                                <span className={ok ? "text-secondary" : "font-medium text-primary"}>{copy.checks[id]}</span>
                                {!ok && copy.fixes[id] && <span className="block text-xs text-tertiary">{copy.fixes[id]}</span>}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
            {result.warnings.length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold text-primary">{copy.warningsTitle}</h3>
                    <ul className="flex flex-col gap-1.5">
                        {result.warnings.map((code) => (
                            <li key={code} className="flex gap-2 text-xs text-secondary">
                                <CircleAlert className="mt-px size-3.5 shrink-0 text-warning-primary" aria-hidden />
                                {copy.warnings[code]}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
