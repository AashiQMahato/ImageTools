import { Eraser, Image as ImageIcon, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/base/buttons/button";
import { PanelBody, PanelIntro, PanelTabs, StudioCanvas, StudioDropzone, StudioError, StudioNotice, StudioProgress, Fitted } from "@/components/studio/StudioParts";
import { StudioShell } from "@/components/studio/StudioShell";
import { BackgroundRemovalEditor } from "@/features/background-removal/editor/BackgroundRemovalEditor";
import { baseName } from "@/features/image-processing/format";
import { useProcessingJob } from "@/features/image-processing/useProcessingJob";
import { removeBackground } from "@/lib/api/backgroundRemovalApi";
import { useImageStore } from "@/store/useImageStore";
import type { ImageFile } from "@/types/image";
import { errorMessage, useT } from "@/i18n";

const fileNameFor = (image: ImageFile) => `${baseName(image.name)}-no-background.png`;

export function RemoveBackgroundPage() {
    const original = useImageStore((state) => state.original);
    const job = useProcessingJob(original, fileNameFor);
    /** The image whose removal was cancelled — shown as stopped, with a button to start again. */
    const [cancelledId, setCancelledId] = useState<string | null>(null);

    /**
     * Removing the background is the only thing this tool does, so choosing an image is already the
     * instruction — there is nothing to configure first. Keyed by image id so cancelling doesn't
     * immediately start it again; Try again is there to retry by hand.
     */
    const autoRan = useRef<string | null>(null);
    const { run: start, status } = job;
    useEffect(() => {
        if (!original || status !== "selected" || autoRan.current === original.id) return;
        autoRan.current = original.id;
        void start(removeBackground);
    }, [original, start, status]);

    // With the cut-out in hand, the studio gains its background, refine and export tools.
    if (original && job.status === "success" && job.result) {
        return <BackgroundRemovalEditor key={job.result.url} original={original} cutout={job.result} />;
    }
    return (
        <WaitingStudio
            original={original}
            job={job}
            cancelled={Boolean(original && cancelledId === original.id && job.status === "selected")}
            onCancel={() => {
                job.cancel();
                setCancelledId(original?.id ?? null);
            }}
            onRetry={() => {
                setCancelledId(null);
                void job.run(removeBackground);
            }}
        />
    );
}

/** The same studio before the cut-out exists: upload, the upload and processing states, and errors. */
function WaitingStudio({ original, job, cancelled, onCancel, onRetry }: { original: ImageFile | null; job: ReturnType<typeof useProcessingJob>; cancelled: boolean; onCancel: () => void; onRetry: () => void }) {
    const t = useT();
    const copy = t.studio;
    const intro = copy.intros.removeBackground;
    const busy = !cancelled && (job.status === "uploading" || job.status === "processing" || job.status === "selected");
    const failed = job.status === "error" || job.status === "unsupported";

    const panel = (
        <>
            <PanelTabs
                label={t.bgEditor.controlsLabel}
                value="background"
                onChange={() => undefined}
                tabs={[
                    { id: "background", label: t.bgEditor.tabs.background, icon: <ImageIcon className="size-4" aria-hidden /> },
                    { id: "refine", label: t.bgEditor.tabs.refine, icon: <Wand2 className="size-4" aria-hidden />, disabled: true },
                ]}
            />
            <PanelBody>
                <PanelIntro title={copy.howItWorks} steps={intro.steps} />
                <p className="rounded-xl bg-secondary p-3 text-xs text-tertiary">{busy && original ? copy.removingBackground : copy.panelEmpty}</p>
            </PanelBody>
        </>
    );

    return (
        <StudioShell tool="removeBackground" panel={panel} panelLabel={t.bgEditor.controlsLabel}>
            <StudioCanvas>
                {!original ? (
                    <StudioDropzone title={copy.dropTitle} hint={intro.hint} />
                ) : failed ? (
                    <StudioError title={copy.errorTitle} message={errorMessage(t, job.error)} onRetry={job.status === "error" ? onRetry : undefined} />
                ) : (
                    <Fitted dimensions={original.dimensions}>
                        {(size) => (
                            <figure className="animate-enter relative overflow-hidden rounded-lg [--i:-1]" style={size}>
                                <img src={original.previewUrl} alt={t.workspace.selectedAlt(original.name)} className="size-full object-contain" draggable={false} />
                                {busy && (
                                    <StudioProgress
                                        uploading={job.status === "uploading"}
                                        uploadProgress={job.uploadProgress}
                                        startedAt={job.startedAt}
                                        label={copy.removingBackground}
                                        onCancel={job.status === "selected" ? undefined : onCancel}
                                    />
                                )}
                                {cancelled && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/25">
                                        <Button size="md" color="primary" iconLeading={Eraser} onPress={onRetry} className="press-scale shadow-lg pointer-coarse:min-h-11">
                                            {t.pages.removeBackground.action}
                                        </Button>
                                    </div>
                                )}
                            </figure>
                        )}
                    </Fitted>
                )}
            </StudioCanvas>
            {original && !failed && <StudioNotice notice={cancelled ? { tone: "info", text: copy.cancelled } : { tone: "info", text: copy.removingBackground }} />}
        </StudioShell>
    );
}
