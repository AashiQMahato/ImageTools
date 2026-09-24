import { Cpu, FileImage, LoaderCircle, Maximize2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ExportFormat } from "@/features/image-processing/exportFormat";
import { FormatPicker } from "@/features/image-processing/FormatPicker";
import { formatBytes, formatDimensions } from "@/features/image-processing/format";
import { useImageStore } from "@/store/useImageStore";
import type { ProcessedImage, UpscaleFactor } from "@/types/image";
import { useT } from "@/i18n";
import { ScaleCards } from "./ScaleCards";
import { megapixels, targetSize } from "./scale";

interface UpscalePanelProps {
    disabledScales: readonly UpscaleFactor[];
    availableScales?: readonly UpscaleFactor[];
    format: ExportFormat;
    onFormatChange: (format: ExportFormat) => void;
    /** Only offered once there is something to download. */
    hasResult: boolean;
    /** What will actually be downloaded. */
    result: ProcessedImage | null;
    /** True while the chosen format is being encoded. */
    working: boolean;
    /** The upload could carry transparency that a format without alpha would flatten. */
    mayHaveAlpha: boolean;
}

/**
 * Settings beside the stage. Everything shown is either a control the API accepts (scale) or a fact
 * the server reports (target size, format, engine) — nothing here promises more than the tool does.
 */
export function UpscalePanel({ disabledScales, availableScales, format, onFormatChange, hasResult, result, working, mayHaveAlpha }: UpscalePanelProps) {
    const t = useT();
    const original = useImageStore((state) => state.original);
    const scale = useImageStore((state) => state.selectedScale);
    const target = original ? targetSize(original.dimensions, scale) : null;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-label text-quaternary">{t.pages.upscale.configTitle}</h2>
                <p className="mt-1.5 text-sm text-tertiary">{t.pages.upscale.configNote}</p>
            </div>

            <ScaleCards disabledScales={disabledScales} availableScales={availableScales} />

            {hasResult && (
                <div>
                    <FormatPicker value={format} onChange={onFormatChange} note={format === "jpeg" && mayHaveAlpha ? t.workspace.flattensAlpha : undefined} />
                    {working && (
                        <p role="status" className="mt-2 flex items-center gap-2 text-xs text-tertiary">
                            <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                            {t.pages.upscale.converting}
                        </p>
                    )}
                </div>
            )}

            {/* What you will actually get, sitting directly under the control that changes it. */}
            <section aria-label={t.pages.upscale.outputLabel}>
                <h3 className="text-label text-quaternary">{t.pages.upscale.outputLabel}</h3>
                <dl className="mt-1 divide-y divide-[var(--card-line)]">
                    <Spec icon={FileImage} label={t.pages.upscale.inputSpec}>
                        {original ? formatDimensions(original.dimensions) : t.pages.upscale.noImageYet}
                    </Spec>
                    <Spec icon={Maximize2} label={t.pages.upscale.targetSpec} emphasis>
                        {target ? `${formatDimensions(target)} · ${t.pages.upscale.megapixels(megapixels(target))}` : t.pages.upscale.noImageYet}
                    </Spec>
                    <Spec icon={FileImage} label={t.pages.upscale.formatSpec}>
                        {t.workspace.formatNames[format]}
                    </Spec>
                    <Spec icon={Cpu} label={result ? t.pages.upscale.sizeSpec : t.pages.upscale.engineSpec}>
                        {result ? formatBytes(result.blob.size) : t.pages.upscale.engineValue}
                    </Spec>
                </dl>
            </section>
        </div>
    );
}

function Spec({ icon: Icon, label, emphasis, children }: { icon: LucideIcon; label: string; emphasis?: boolean; children: ReactNode }) {
    return (
        <div className="spec-row">
            <dt className="flex items-center gap-2 text-tertiary">
                <Icon className="size-3.5 shrink-0 text-quaternary" aria-hidden />
                {label}
            </dt>
            <dd className={emphasis ? "text-right font-semibold text-primary tabular-nums" : "text-right text-secondary tabular-nums"}>{children}</dd>
        </div>
    );
}
