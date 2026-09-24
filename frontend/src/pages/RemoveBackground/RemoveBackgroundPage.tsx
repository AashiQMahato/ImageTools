import { Eraser } from "lucide-react";
import { useCallback } from "react";
import { baseName } from "@/features/image-processing/format";
import { ImageWorkspace } from "@/features/image-processing/ImageWorkspace";
import { ToolPage } from "@/features/image-processing/ToolPage";
import { useProcessingJob } from "@/features/image-processing/useProcessingJob";
import { removeBackground } from "@/lib/api/backgroundRemovalApi";
import { useImageStore } from "@/store/useImageStore";
import type { ImageFile } from "@/types/image";
import { useT } from "@/i18n";

const fileNameFor = (image: ImageFile) => `${baseName(image.name)}-no-background.png`;

export function RemoveBackgroundPage() {
    const t = useT();
    const original = useImageStore((state) => state.original);
    const job = useProcessingJob(original, fileNameFor);
    const run = useCallback(() => void job.run(removeBackground), [job]);

    return (
        <ToolPage
            name={t.pages.removeBackground.name}
            badge={t.toolPage.aiTool}
            guide={t.guides.removeBackground}
            title={
                <>
                    {t.pages.removeBackground.title} <span className="text-[var(--indigo)]">{t.pages.removeBackground.accent}</span>
                </>
            }
            description={t.pages.removeBackground.description}
        >
            <ImageWorkspace
                original={original}
                job={job}
                action={{ label: t.pages.removeBackground.action, icon: Eraser, onRun: run }}
                compare={{ beforeLabel: t.common.original, afterLabel: t.workspace.backgroundRemoved }}
                transparentResult
            />
        </ToolPage>
    );
}
