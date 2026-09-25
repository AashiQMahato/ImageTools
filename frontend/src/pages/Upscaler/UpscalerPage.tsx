import { ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExportFormat } from "@/features/image-processing/exportFormat";
import { baseName, formatDimensions } from "@/features/image-processing/format";
import { useReencode } from "@/features/image-processing/useReencode";
import { ImageWorkspace } from "@/features/image-processing/ImageWorkspace";
import { ToolPage } from "@/features/image-processing/ToolPage";
import { useProcessingJob } from "@/features/image-processing/useProcessingJob";
import { targetSize } from "@/features/upscaler/scale";
import { UpscalePanel } from "@/features/upscaler/UpscalePanel";
import { getProcessorHealth } from "@/lib/api/processorsApi";
import { upscaleImage } from "@/lib/api/upscaleApi";
import { cn } from "@/lib/utils/cn";
import { useImageStore } from "@/store/useImageStore";
import type { ImageFile, UpscaleFactor } from "@/types/image";
import { type AppErrorInfo, useT } from "@/i18n";

/** Mirrors the API's default output limit, so impossible choices are disabled up front. */
const MAX_OUTPUT_PIXELS = 40_000_000;

export function UpscalerPage() {
    const t = useT();
    const original = useImageStore((state) => state.original);
    const scale = useImageStore((state) => state.selectedScale);
    const setScale = useImageStore((state) => state.setSelectedScale);
    const fileNameFor = useCallback((image: ImageFile) => `${baseName(image.name)}-upscaled-${scale}x.png`, [scale]);
    const job = useProcessingJob(original, fileNameFor);
    const [unsupported, setUnsupported] = useState<AppErrorInfo | null>(null);
    const [serverScales, setServerScales] = useState<UpscaleFactor[] | undefined>(undefined);
    // null until the server has answered — the chip stays hidden rather than guessing.
    const [engineOk, setEngineOk] = useState<boolean | null>(null);

    // Ask the API up front whether this server can upscale, instead of letting someone wait for a failure.
    useEffect(() => {
        const controller = new AbortController();
        getProcessorHealth(controller.signal)
            .then((health) => {
                setUnsupported(health.upscaling.available ? null : { code: "UPSCALING_UNAVAILABLE", message: health.upscaling.message ?? undefined });
                setEngineOk(health.upscaling.available);
                setServerScales(health.upscaling.scales.filter((value): value is UpscaleFactor => value === 2 || value === 4));
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, []);

    const pixels = original ? original.dimensions.width * original.dimensions.height : 0;
    const tooLarge = useMemo(() => ([2, 4] as UpscaleFactor[]).filter((option) => pixels * option * option > MAX_OUTPUT_PIXELS), [pixels]);
    useEffect(() => {
        if (tooLarge.includes(scale) && !tooLarge.includes(2)) setScale(2);
    }, [tooLarge, scale, setScale]);

    const run = useCallback(() => void job.run((file, options) => upscaleImage(file, scale, options)), [job, scale]);
    const target = original ? targetSize(original.dimensions, scale) : null;

    // The API always returns PNG; anything else is converted here, on this device.
    const [format, setFormat] = useState<ExportFormat>("png");
    const { encoded, working } = useReencode(job.result, format, "png", `upscaled-${scale}x`, original?.name);
    const shown = encoded ?? job.result;
    // Only a JPEG upload definitely has no alpha to lose.
    const mayHaveAlpha = original?.mimeType !== "image/jpeg";

    return (
        <ToolPage
            name={t.pages.upscale.name}
            badge={t.toolPage.aiTool}
            hue="upscale"
            status={<EngineChip available={engineOk} />}
            title={
                <>
                    {t.pages.upscale.title} <span className="text-[var(--tool)]">{t.pages.upscale.accent}</span>
                </>
            }
            description={t.pages.upscale.description}
        >
            <ImageWorkspace
                original={original}
                job={job}
                action={{ label: t.pages.upscale.action(scale), icon: ZoomIn, onRun: run }}
                configPanel={
                    <UpscalePanel
                        disabledScales={tooLarge}
                        availableScales={serverScales}
                        format={format}
                        onFormatChange={setFormat}
                        hasResult={Boolean(job.result)}
                        result={shown}
                        working={working}
                        mayHaveAlpha={mayHaveAlpha}
                    />
                }
                railSpecs={
                    <>
                        <span>
                            {t.pages.upscale.inputSpec} {original ? formatDimensions(original.dimensions) : t.pages.upscale.noImageYet}
                        </span>
                        <span>
                            {t.pages.upscale.targetSpec} {target ? formatDimensions(target) : t.pages.upscale.noImageYet}
                        </span>
                        <span>
                            {t.pages.upscale.formatSpec} {t.workspace.formatNames[format]}
                        </span>
                    </>
                }
                compare={{ beforeLabel: t.common.original, afterLabel: t.workspace.upscaled }}
                zoomable
                displayResult={shown}
                unsupportedMessage={unsupported}
            />
        </ToolPage>
    );
}

/** Whether this server can actually run the model — the one fact worth showing before you upload. */
function EngineChip({ available }: { available: boolean | null }) {
    const t = useT();
    if (available === null) return null;
    return (
        <span
            className={cn(
                "hidden items-center gap-2 rounded-full border px-3 py-1 text-[0.75rem] font-medium sm:inline-flex",
                available ? "border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--card-line)] bg-secondary text-tertiary",
            )}
        >
            <span aria-hidden className={cn("status-dot", available ? "text-success-primary" : "text-warning-primary")} />
            {available ? t.pages.upscale.engineReady : t.pages.upscale.engineDown}
        </span>
    );
}
