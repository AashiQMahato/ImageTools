import { Check, Cpu, Eraser, FileImage, Layers, LoaderCircle, Maximize2, RotateCcw, Undo2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { formatBytes, formatDimensions } from "@/features/image-processing/format";
import { useImageStore } from "@/store/useImageStore";
import type { ProcessedImage } from "@/types/image";
import { useT } from "@/i18n";
import { type ExportFormat } from "@/features/image-processing/exportFormat";
import { FormatPicker } from "@/features/image-processing/FormatPicker";
import { type Background, losesTransparency } from "./background";
import { BackgroundPicker } from "./BackgroundPicker";
import type { BrushMode } from "./retouch";

export interface RetouchControls {
    available: boolean;
    active: boolean;
    onToggle: (active: boolean) => void;
    mode: BrushMode;
    onModeChange: (mode: BrushMode) => void;
    hasSelection: boolean;
    onApply: () => void;
    onClearSelection: () => void;
    editCount: number;
    onUndo: () => void;
    onClear: () => void;
}

interface RemoveBackgroundPanelProps {
    background: Background;
    onBackgroundChange: (background: Background) => void;
    format: ExportFormat;
    onFormatChange: (format: ExportFormat) => void;
    /** The picker only appears once there is a cut-out to place on something. */
    hasResult: boolean;
    /** What will actually be downloaded. */
    result: ProcessedImage | null;
    /** A new export is being encoded; the previous one is still on screen meanwhile. */
    working: boolean;
    retouch: RetouchControls;
}

/**
 * Background removal itself takes no options — the model is chosen by the server operator, never by
 * a request. So before a result this column answers the only open question (what comes back), and
 * after one it offers the steps that do belong on this device: fixing what the model missed,
 * choosing a backdrop, and picking the format to take away.
 */
export function RemoveBackgroundPanel({ background, onBackgroundChange, format, onFormatChange, hasResult, result, working, retouch }: RemoveBackgroundPanelProps) {
    const t = useT();
    const original = useImageStore((state) => state.original);
    const size = original ? formatDimensions(original.dimensions) : t.pages.removeBackground.noImageYet;

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h2 className="text-label text-quaternary">{t.pages.removeBackground.configTitle}</h2>
                <p className="mt-1.5 text-sm text-tertiary">{hasResult ? t.pages.removeBackground.configNoteResult : t.pages.removeBackground.configNote}</p>
            </div>

            {retouch.available && <Retouch controls={retouch} />}

            {hasResult && !retouch.active && (
                <>
                    <div>
                        <BackgroundPicker value={background} onChange={onBackgroundChange} />
                        {working && (
                            <p role="status" className="mt-3 flex items-center gap-2 text-xs text-tertiary">
                                <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                                {t.pages.removeBackground.replacing}
                            </p>
                        )}
                    </div>
                    <FormatPicker
                        value={format}
                        onChange={onFormatChange}
                        unavailable={losesTransparency(background, "jpeg") ? { jpeg: t.workspace.noAlpha } : undefined}
                    />
                </>
            )}

            <section aria-label={t.pages.removeBackground.outputLabel}>
                <h3 className="text-label text-quaternary">{t.pages.removeBackground.outputLabel}</h3>
                <dl className="mt-1 divide-y divide-[var(--card-line)]">
                    <Spec icon={FileImage} label={t.pages.removeBackground.inputSpec}>
                        {size}
                    </Spec>
                    <Spec icon={Maximize2} label={t.pages.removeBackground.targetSpec} emphasis>
                        {size}
                    </Spec>
                    <Spec icon={Layers} label={t.pages.removeBackground.formatSpec}>
                        {t.workspace.formatNames[format]}
                    </Spec>
                    <Spec icon={Cpu} label={result ? t.pages.removeBackground.sizeSpec : t.pages.removeBackground.engineSpec}>
                        {result ? formatBytes(result.blob.size) : t.pages.removeBackground.engineValue}
                    </Spec>
                </dl>
            </section>
        </div>
    );
}

/**
 * Manual clean-up for what the model missed. An area is selected first and applied second, so the
 * ring on the stage is a preview of exactly which pixels will move — nothing changes under the
 * pointer while you are still deciding.
 */
function Retouch({ controls }: { controls: RetouchControls }) {
    const t = useT();
    const pill = "press-scale w-full rounded-full before:rounded-full";

    if (!controls.active) {
        return (
            <Button size="sm" color="secondary" iconLeading={Eraser} onPress={() => controls.onToggle(true)} className={pill}>
                {t.pages.removeBackground.startRetouch}
            </Button>
        );
    }

    return (
        <section aria-label={t.pages.removeBackground.cleanUpLabel} className="flex flex-col gap-3">
            <Segmented
                label={t.pages.removeBackground.cleanUpLabel}
                value={controls.mode}
                onChange={controls.onModeChange}
                options={[
                    { value: "erase" as BrushMode, label: t.pages.removeBackground.erase, ariaLabel: t.pages.removeBackground.eraseAria },
                    { value: "restore" as BrushMode, label: t.pages.removeBackground.restore, ariaLabel: t.pages.removeBackground.restoreAria },
                ]}
            />

            <p className="text-xs text-tertiary">{controls.hasSelection ? t.pages.removeBackground.selectionReady : t.pages.removeBackground.selectHint}</p>

            <Button size="sm" color="primary" iconLeading={Check} onPress={controls.onApply} isDisabled={!controls.hasSelection} className={pill}>
                {controls.mode === "erase" ? t.pages.removeBackground.applyErase : t.pages.removeBackground.applyRestore}
            </Button>
            <Button size="sm" color="tertiary" onPress={controls.onClearSelection} isDisabled={!controls.hasSelection} className={pill}>
                {t.pages.removeBackground.clearSelection}
            </Button>

            <div className="flex items-center gap-2 border-t border-[var(--card-line)] pt-3">
                <Button size="sm" color="tertiary" iconLeading={Undo2} onPress={controls.onUndo} isDisabled={controls.editCount === 0} className="press-scale rounded-full before:rounded-full">
                    {t.pages.removeBackground.undoEdit}
                </Button>
                <Button size="sm" color="tertiary" iconLeading={RotateCcw} onPress={controls.onClear} isDisabled={controls.editCount === 0} className="press-scale rounded-full before:rounded-full">
                    {t.pages.removeBackground.resetEdits}
                </Button>
                <span className="ml-auto text-xs text-quaternary tabular-nums">{controls.editCount > 0 && t.pages.removeBackground.editCount(controls.editCount)}</span>
            </div>

            <Button size="sm" color="secondary" onPress={() => controls.onToggle(false)} className={pill}>
                {t.pages.removeBackground.stopRetouch}
            </Button>
        </section>
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
