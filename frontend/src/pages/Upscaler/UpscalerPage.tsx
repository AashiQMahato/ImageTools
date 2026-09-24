import { ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { baseName } from "@/features/image-processing/format";
import { ImageWorkspace } from "@/features/image-processing/ImageWorkspace";
import { ToolPage } from "@/features/image-processing/ToolPage";
import { useProcessingJob } from "@/features/image-processing/useProcessingJob";
import { ScalePicker } from "@/features/upscaler/ScalePicker";
import { getProcessorHealth } from "@/lib/api/processorsApi";
import { upscaleImage } from "@/lib/api/upscaleApi";
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

    // Ask the API up front whether this server can upscale, instead of letting someone wait for a failure.
    useEffect(() => {
        const controller = new AbortController();
        getProcessorHealth(controller.signal)
            .then((health) => setUnsupported(health.upscaling.available ? null : { code: "UPSCALING_UNAVAILABLE", message: health.upscaling.message ?? undefined }))
            .catch(() => undefined);
        return () => controller.abort();
    }, []);

    const pixels = original ? original.dimensions.width * original.dimensions.height : 0;
    const tooLarge = useMemo(() => ([2, 4] as UpscaleFactor[]).filter((option) => pixels * option * option > MAX_OUTPUT_PIXELS), [pixels]);
    useEffect(() => {
        if (tooLarge.includes(scale) && !tooLarge.includes(2)) setScale(2);
    }, [tooLarge, scale, setScale]);

    const run = useCallback(() => void job.run((file, options) => upscaleImage(file, scale, options)), [job, scale]);

    return (
        <ToolPage
            name={t.pages.upscale.name}
            badge={t.toolPage.aiTool}
            guide={t.guides.upscale}
            title={
                <>
                    {t.pages.upscale.title} <span className="text-[var(--indigo)]">{t.pages.upscale.accent}</span>
                </>
            }
            description={t.pages.upscale.description}
        >
            <ImageWorkspace
                original={original}
                job={job}
                action={{ label: t.pages.upscale.action(scale), icon: ZoomIn, onRun: run }}
                controls={<ScalePicker disabledScales={tooLarge} />}
                compare={{ beforeLabel: t.common.original, afterLabel: t.workspace.upscaled }}
                zoomable
                unsupportedMessage={unsupported}
            />
        </ToolPage>
    );
}
