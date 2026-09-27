import { ScanSearch } from "lucide-react";
import type { WatermarkDetection } from "@/lib/api/watermarkApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

interface DetectionListProps {
    detections: WatermarkDetection[] | null;
    selected: readonly string[];
    onChange: (selected: string[]) => void;
    detecting: boolean;
    failed: boolean;
    disabled?: boolean;
}

/**
 * What detection found, as a checklist: each region can be kept or dropped before anything is removed.
 * Nothing here removes anything by itself.
 */
export function DetectionList({ detections, selected, onChange, detecting, failed, disabled }: DetectionListProps) {
    const t = useT();
    const copy = t.watermark;
    const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
    return (
        <section aria-busy={detecting}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-primary">{copy.detectedTitle}</h3>
                {detections && detections.length > 1 && (
                    <div className="flex gap-1">
                        <button type="button" disabled={disabled} onClick={() => onChange(detections.map((detection) => detection.id))} className="h-8 cursor-pointer rounded-lg px-2 text-xs font-semibold text-[var(--brand)] outline-focus-ring hover:bg-secondary focus-visible:outline-2 disabled:opacity-50 pointer-coarse:h-10">
                            {copy.selectAll}
                        </button>
                        <button type="button" disabled={disabled} onClick={() => onChange([])} className="h-8 cursor-pointer rounded-lg px-2 text-xs font-semibold text-tertiary outline-focus-ring hover:bg-secondary focus-visible:outline-2 disabled:opacity-50 pointer-coarse:h-10">
                            {copy.deselectAll}
                        </button>
                    </div>
                )}
            </div>
            <p role="status" className="mt-1 flex items-center gap-2 text-xs text-tertiary">
                {detecting && <ScanSearch className="size-3.5 animate-pulse text-[var(--brand)] motion-reduce:animate-none" aria-hidden />}
                {detecting ? copy.detecting : failed ? copy.detectFailed : detections ? (detections.length ? copy.found(detections.length) : copy.none) : null}
            </p>
            {detections && detections.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1">
                    {detections.map((detection, index) => {
                        const checked = selected.includes(detection.id);
                        const percent = Math.round(detection.confidence * 100);
                        return (
                            <li key={detection.id}>
                                <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors duration-150 pointer-coarse:py-3", checked ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-[var(--card-line)] hover:bg-secondary")}>
                                    <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(detection.id)} className="size-4 shrink-0 accent-[var(--brand)]" />
                                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary tabular-nums">{index + 1}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-primary">{copy.types[detection.type] ?? copy.possible}</span>
                                        <span className="mt-1 flex items-center gap-2">
                                            <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-secondary">
                                                <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${percent}%` }} />
                                            </span>
                                            <span className="text-xs text-tertiary tabular-nums">{copy.sure(percent)}</span>
                                        </span>
                                    </span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

/**
 * The detected regions over the image: numbered outlines — solid when selected, dashed when not —
 * with a small label. Drawn in image coordinates, so they zoom and pan with the photo.
 */
export function DetectionOverlay({ detections, selected, width, height, onToggle }: { detections: WatermarkDetection[]; selected: readonly string[]; width: number; height: number; onToggle: (id: string) => void }) {
    const t = useT();
    const copy = t.watermark;
    return (
        <div className="retouch-fade-in pointer-events-none absolute inset-0">
            <svg aria-hidden viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
                {detections.map((detection) => {
                    const on = selected.includes(detection.id);
                    return (
                        <polygon
                            key={detection.id}
                            points={detection.polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                            fill={on ? "rgb(139 92 246 / 0.12)" : "none"}
                            stroke={on ? "rgb(167 139 250)" : "white"}
                            strokeWidth={on ? 2 : 1.5}
                            strokeDasharray={on ? undefined : "6 5"}
                            vectorEffect="non-scaling-stroke"
                            style={{ filter: "drop-shadow(0 0 1px rgb(0 0 0 / 0.6))" }}
                        />
                    );
                })}
            </svg>
            {detections.map((detection, index) => {
                const on = selected.includes(detection.id);
                return (
                    <button
                        key={detection.id}
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => onToggle(detection.id)}
                        aria-pressed={on}
                        title={`${copy.types[detection.type] ?? copy.possible} · ${copy.sure(Math.round(detection.confidence * 100))}`}
                        className={cn(
                            "pointer-events-auto absolute flex h-6 -translate-y-full cursor-pointer items-center gap-1 rounded-md px-1.5 text-[0.6875rem] font-semibold whitespace-nowrap shadow-sm outline-white focus-visible:outline-2",
                            on ? "bg-violet-500 text-white" : "bg-neutral-950/60 text-white/90 backdrop-blur-sm",
                        )}
                        style={{ left: `${(detection.box.x / width) * 100}%`, top: `${(detection.box.y / height) * 100}%` }}
                    >
                        <span className="tabular-nums">{index + 1}</span>
                        <span className="hidden sm:inline">{copy.possible}</span>
                    </button>
                );
            })}
        </div>
    );
}
