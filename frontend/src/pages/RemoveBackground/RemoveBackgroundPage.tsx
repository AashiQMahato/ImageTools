import { Eraser } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Background, losesTransparency, TRANSPARENT } from "@/features/background-removal/background";
import type { ExportFormat } from "@/features/image-processing/exportFormat";
import { RemoveBackgroundPanel } from "@/features/background-removal/RemoveBackgroundPanel";
import { RetouchStage } from "@/features/background-removal/RetouchStage";
import { useComposite } from "@/features/background-removal/useComposite";
import { useRetouch } from "@/features/background-removal/useRetouch";
import { baseName, formatDimensions } from "@/features/image-processing/format";
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

    /**
     * Removing the background is the only thing this tool does, so choosing an image is already the
     * instruction — there is nothing to configure first. Keyed by image id so cancelling doesn't
     * immediately start it again; the button is still there to retry by hand.
     */
    const autoRan = useRef<string | null>(null);
    const { run: start, status } = job;
    useEffect(() => {
        if (!original || status !== "selected" || autoRan.current === original.id) return;
        autoRan.current = original.id;
        void start(removeBackground);
    }, [original, start, status]);

    const [background, setBackground] = useState<Background>(TRANSPARENT);
    // A new image means a new subject, so the previous backdrop no longer applies. Adjusted during
    // render rather than in an effect, so the workspace never paints one frame with the stale choice.
    const [chosenFor, setChosenFor] = useState(original?.id);
    if (chosenFor !== original?.id) {
        setChosenFor(original?.id);
        setBackground(TRANSPARENT);
    }

    // Manual clean-up sits between the model's output and the backdrop: brush first, composite second.
    const retouch = useRetouch(job.result, original);
    const [retouching, setRetouching] = useState(false);
    const canRetouch = Boolean(job.result) && retouch.ready;
    const active = retouching && canRetouch;
    const cutout = retouch.edited ?? job.result;

    const [format, setFormat] = useState<ExportFormat>("png");
    // Switching to a transparent backdrop while JPG is selected would silently flatten it.
    const exportFormat: ExportFormat = losesTransparency(background, format) ? "png" : format;

    const { composed, working } = useComposite(cutout, background, exportFormat, original?.name);
    const shown = composed ?? cutout;

    return (
        <ToolPage
            name={t.pages.removeBackground.name}
            badge={t.toolPage.aiTool}
            hue="remove-background"
            guide={t.guides.removeBackground}
            title={
                <>
                    {t.pages.removeBackground.title} <span className="text-[var(--tool)]">{t.pages.removeBackground.accent}</span>
                </>
            }
            description={t.pages.removeBackground.description}
        >
            <ImageWorkspace
                original={original}
                job={job}
                action={{ label: t.pages.removeBackground.action, icon: Eraser, onRun: run }}
                configPanel={
                    <RemoveBackgroundPanel
                        background={background}
                        onBackgroundChange={setBackground}
                        hasResult={Boolean(job.result)}
                        format={exportFormat}
                        onFormatChange={setFormat}
                        result={shown}
                        working={working}
                        retouch={{
                            available: canRetouch,
                            active,
                            onToggle: setRetouching,
                            mode: retouch.mode,
                            onModeChange: retouch.setMode,
                            hasSelection: retouch.selection !== null,
                            onApply: retouch.apply,
                            onClearSelection: () => retouch.setSelection(null),
                            editCount: retouch.editCount,
                            onUndo: retouch.undo,
                            onClear: retouch.clear,
                        }}
                    />
                }
                railSpecs={
                    <>
                        <span>
                            {t.pages.removeBackground.inputSpec} {original ? formatDimensions(original.dimensions) : t.pages.removeBackground.noImageYet}
                        </span>
                        <span>
                            {t.pages.removeBackground.formatSpec}{" "}
                            {background.kind === "transparent" ? t.pages.removeBackground.formatValue : t.pages.removeBackground.formatValueOpaque}
                        </span>
                    </>
                }
                transparentResult={active || background.kind === "transparent"}
                displayResult={active ? cutout : shown}
                stageOverride={
                    active
                        ? (size) => (
                              <RetouchStage
                                  canvas={retouch.canvas}
                                  revision={retouch.revision}
                                  size={size}
                                  mode={retouch.mode}
                                  selection={retouch.selection}
                                  onSelect={retouch.setSelection}
                                  onApply={retouch.apply}
                              />
                          )
                        : null
                }
            />
        </ToolPage>
    );
}
