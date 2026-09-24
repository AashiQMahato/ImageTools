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

/** Mirrors the API's default output limit, so impossible choices are disabled up front. */
const MAX_OUTPUT_PIXELS = 40_000_000;

export function UpscalerPage() {
    const original = useImageStore((state) => state.original);
    const scale = useImageStore((state) => state.selectedScale);
    const setScale = useImageStore((state) => state.setSelectedScale);
    const fileNameFor = useCallback((image: ImageFile) => `${baseName(image.name)}-upscaled-${scale}x.png`, [scale]);
    const job = useProcessingJob(original, fileNameFor);
    const [unsupported, setUnsupported] = useState<string | null>(null);

    // Ask the API up front whether this server can upscale, instead of letting someone wait for a failure.
    useEffect(() => {
        const controller = new AbortController();
        getProcessorHealth(controller.signal)
            .then((health) => setUnsupported(health.upscaling.available ? null : (health.upscaling.message ?? "Upscaling is unavailable on this server.")))
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
            title={
                <>
                    Upscale. <span className="text-quaternary">Bring back the detail.</span>
                </>
            }
            description="Enlarge an image 2× or 4× with AI, then compare it with the original up close."
        >
            <ImageWorkspace
                original={original}
                job={job}
                action={{ label: `Upscale ${scale}×`, icon: ZoomIn, onRun: run }}
                controls={<ScalePicker disabledScales={tooLarge} />}
                compare={{ beforeLabel: "Original", afterLabel: "Upscaled" }}
                zoomable
                unsupportedMessage={unsupported}
            />
        </ToolPage>
    );
}
