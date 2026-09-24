import { Eraser } from "lucide-react";
import { useCallback } from "react";
import { baseName } from "@/features/image-processing/format";
import { ImageWorkspace } from "@/features/image-processing/ImageWorkspace";
import { ToolPage } from "@/features/image-processing/ToolPage";
import { useProcessingJob } from "@/features/image-processing/useProcessingJob";
import { removeBackground } from "@/lib/api/backgroundRemovalApi";
import { useImageStore } from "@/store/useImageStore";
import type { ImageFile } from "@/types/image";

const fileNameFor = (image: ImageFile) => `${baseName(image.name)}-no-background.png`;

export function RemoveBackgroundPage() {
    const original = useImageStore((state) => state.original);
    const job = useProcessingJob(original, fileNameFor);
    const run = useCallback(() => void job.run(removeBackground), [job]);

    return (
        <ToolPage
            title={
                <>
                    Remove background. <span className="text-quaternary">Keep the subject.</span>
                </>
            }
            description="Upload a photo and get a clean, transparent PNG of the subject."
        >
            <ImageWorkspace
                original={original}
                job={job}
                action={{ label: "Remove background", icon: Eraser, onRun: run }}
                compare={{ beforeLabel: "Original", afterLabel: "Background removed" }}
                transparentResult
            />
        </ToolPage>
    );
}
