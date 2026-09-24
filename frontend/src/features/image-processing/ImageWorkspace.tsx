import { AlertCircle, Check, Download, ImagePlus, LoaderCircle, RotateCcw, X } from "lucide-react";
import { type FC, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { CompareSlider } from "@/components/common/CompareSlider";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { useFitSize } from "@/hooks/useFitSize";
import { useImageUpload } from "@/hooks/useImageUpload";
import { cn } from "@/lib/utils/cn";
import { useImageStore } from "@/store/useImageStore";
import { downloadFile } from "@/lib/utils/download";
import type { ImageFile, ProcessedImage } from "@/types/image";
import { DropZone } from "./DropZone";
import { type RailTone, StatusRail } from "./StatusRail";
import { formatBytes, formatDimensions } from "./format";
import type { useProcessingJob } from "./useProcessingJob";
import { type AppErrorInfo, errorMessage, useT } from "@/i18n";

type Job = ReturnType<typeof useProcessingJob>;
type Status = Job["status"];

const pill = "press-scale rounded-full before:rounded-full";
const ZOOM_LEVELS = [1, 2, 4] as const;

const RAIL_TONES: Record<Status, RailTone> = {
    idle: "idle",
    selected: "active",
    uploading: "busy",
    processing: "busy",
    success: "done",
    error: "error",
    unsupported: "warning",
};

interface ImageWorkspaceProps {
    original: ImageFile | null;
    job: Job;
    action: { label: string; icon: FC<{ className?: string }>; onRun: () => void };
    /** Settings shown beside the primary action before processing (e.g. scale). */
    controls?: ReactNode;
    /**
     * A column of settings beside the stage. When given, the workspace becomes two-column on wide
     * screens and the primary action moves to the foot of that column, next to what it acts on.
     */
    configPanel?: ReactNode;
    /** Tool-specific facts for the status rail (e.g. input and target size). */
    railSpecs?: ReactNode;
    /** Before/after labels. Omit to show the result on its own, with no divider. */
    compare?: { beforeLabel: string; afterLabel: string };
    /** Show the transparency grid behind the result (background removal). */
    transparentResult?: boolean;
    /**
     * Replaces the job's own result for display and download — used when a tool post-processes it
     * on this device (e.g. compositing the cut-out onto a new background).
     */
    displayResult?: ProcessedImage | null;
    /**
     * Replaces the result view with the tool's own stage — used when the result becomes editable
     * (e.g. brushing away what background removal missed). Receives the fitted size.
     */
    stageOverride?: ((size: { width: number; height: number }) => ReactNode) | null;
    /** Offer zoom levels on the result (upscaling). */
    zoomable?: boolean;
    /** Shown instead of the workspace when the server can't run this tool. */
    unsupportedMessage?: AppErrorInfo | null;
}

/** The AI tools' studio: file bar on top, the photo on a quiet stage, actions along the bottom. */
export function ImageWorkspace({ original, job, action, controls, configPanel, railSpecs, compare, transparentResult, displayResult, stageOverride, zoomable, unsupportedMessage }: ImageWorkspaceProps) {
    const t = useT();
    const upload = useImageUpload({ navigateTo: null });
    const clearImage = useImageStore((state) => state.clear);
    const areaRef = useRef<HTMLDivElement>(null);
    const status: Status = unsupportedMessage && job.status !== "success" ? "unsupported" : job.status;
    const shown = displayResult ?? job.result;
    const dimensions = job.result?.dimensions ?? original?.dimensions ?? null;
    const size = useFitSize(areaRef, dimensions ? dimensions.width / dimensions.height : null);
    const busy = status === "uploading" || status === "processing";

    return (
        <div className="studio flex flex-col">
            <input {...upload.inputProps} aria-hidden />

            {/* Top bar — what you're working on. */}
            <div className="studio-line flex min-h-14 items-center gap-3 border-b px-3 py-2 sm:px-4">
                <FileInfo original={original} />
                <div className="ml-auto flex shrink-0 items-center gap-2">
                    <StatusBadge status={status} result={shown} />
                    {original && status !== "uploading" && status !== "processing" && (
                        <Button size="sm" color="tertiary" iconLeading={ImagePlus} onPress={upload.openPicker} className={pill} aria-label={t.common.chooseAnother}>
                            <span className="hidden sm:inline">{t.common.replace}</span>
                        </Button>
                    )}
                    {original && status !== "uploading" && status !== "processing" && (
                        <Button size="sm" color="tertiary" iconLeading={X} onPress={clearImage} className={pill} aria-label={t.common.closeImage} />
                    )}
                </div>
            </div>

            <StatusRail tone={RAIL_TONES[status]} label={t.workspace.state[status]} specs={railSpecs} privacy={t.workspace.privacy} />

            <div className={cn("flex flex-col", configPanel && "lg:flex-row lg:items-stretch")}>
                {/* Stage */}
                <div className="studio-stage relative flex h-[min(56svh,520px)] min-h-[20rem] flex-1 p-4 sm:h-[min(64svh,720px)] sm:min-h-[24rem] sm:p-8">
                    <div ref={areaRef} className="relative flex flex-1 items-center justify-center">
                    {status === "idle" && <DropZone onChoose={upload.openPicker} />}

                    {status === "unsupported" && <Unsupported message={errorMessage(t, unsupportedMessage ?? job.error)} />}

                    {original && status !== "idle" && status !== "success" && status !== "unsupported" && size && (
                        <figure
                            className={cn("animate-enter relative overflow-hidden rounded-xl shadow-canvas [--i:-1]", original.mimeType !== "image/jpeg" && "bg-checkerboard")}
                            style={size}
                        >
                            <img src={original.previewUrl} alt={t.workspace.selectedAlt(original.name)} className="size-full object-contain" draggable={false} />
                            {busy && <BusyOverlay job={job} />}
                        </figure>
                    )}

                    {status === "success" && shown && original && size && (
                        stageOverride ? (
                            stageOverride(size)
                        ) : (
                            <ResultView original={original} result={shown} size={size} compare={compare} transparentResult={transparentResult} zoomable={zoomable} />
                        )
                    )}
                    </div>
                </div>

                {/* Inspector — the settings, then the one thing to do next, beside what they act on. */}
                {configPanel && (
                    <aside
                        aria-label={t.workspace.settings}
                        className="studio-line flex shrink-0 flex-col border-t p-4 sm:p-5 lg:w-[21.5rem] lg:border-t-0 lg:border-l"
                    >
                        <div className="animate-enter [--i:6]">{configPanel}</div>
                        <div className="mt-6 lg:mt-auto lg:pt-6">
                            <Actions status={status} job={job} result={shown} action={action} controls={controls} onChoose={upload.openPicker} stacked />
                        </div>
                    </aside>
                )}
            </div>

            {/* Bottom bar — what just happened, and (without an inspector) what to do next. */}
            <div className="studio-line flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t px-3 py-3 sm:px-4">
                <Hint status={status} job={job} uploadError={upload.error} compare={compare} />
                {!configPanel && <Actions status={status} job={job} result={shown} action={action} controls={controls} onChoose={upload.openPicker} />}
            </div>
        </div>
    );
}

function FileInfo({ original }: { original: ImageFile | null }) {
    const t = useT();
    if (!original) {
        return <p className="text-sm font-medium text-tertiary">{t.workspace.noImage}</p>;
    }
    return (
        <div className="flex min-w-0 items-center gap-3">
            <img src={original.previewUrl} alt="" className="size-8 shrink-0 rounded-md object-cover shadow-xs ring-1 ring-black/5 dark:ring-white/10" />
            <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold text-primary">{original.name}</p>
                <p className="truncate text-xs text-tertiary tabular-nums">
                    {formatDimensions(original.dimensions)} · {formatBytes(original.size)}
                </p>
            </div>
        </div>
    );
}

function StatusBadge({ status, result }: { status: Status; result: ProcessedImage | null }) {
    if (status === "success" && result) {
        return (
            <span className="hidden items-center gap-1.5 rounded-full bg-[var(--seg-track)] px-3 py-1 text-xs font-medium text-secondary tabular-nums sm:flex">
                <Check className="size-3.5 text-success-primary" aria-hidden />
                {formatDimensions(result.dimensions)} · {formatBytes(result.blob.size)}
            </span>
        );
    }
    return null;
}

function Hint({ status, job, uploadError, compare }: { status: Status; job: Job; uploadError: string | null; compare?: ImageWorkspaceProps["compare"] }) {
    const t = useT();
    let text: ReactNode = null;
    let tone = "text-tertiary";
    if (uploadError) {
        text = uploadError;
        tone = "text-error-primary";
    } else if (status === "error") {
        text = errorMessage(t, job.error);
        tone = "text-error-primary";
    } else if (status === "success") {
        text = compare ? t.workspace.hintSuccess(compare.beforeLabel, compare.afterLabel) : t.workspace.hintReady;
    } else if (status === "processing") {
        text = t.workspace.hintProcessing;
    } else if (status === "selected") {
        text = t.workspace.hintSelected;
    } else if (status === "idle") {
        text = t.workspace.hintIdle;
    }
    return <p className={cn("w-full min-w-0 text-sm sm:w-auto sm:flex-1", tone)}>{text}</p>;
}

function Actions({
    status,
    job,
    result,
    action,
    controls,
    onChoose,
    stacked,
}: {
    status: Status;
    job: Job;
    result: ProcessedImage | null;
    action: ImageWorkspaceProps["action"];
    controls?: ReactNode;
    onChoose: () => void;
    /** Full-width buttons in a column, for the inspector. */
    stacked?: boolean;
}) {
    const t = useT();
    const Icon = action.icon;
    return (
        <div
            key={status}
            className={cn(
                "animate-enter [--i:-1]",
                stacked ? "flex flex-col-reverse gap-2 *:w-full" : "ml-auto flex flex-wrap items-center justify-end gap-2",
            )}
        >
            {status === "idle" && (
                <Button size="md" color="primary" iconLeading={ImagePlus} onPress={onChoose} className={pill}>
                    {t.common.chooseImage}
                </Button>
            )}
            {status === "selected" && (
                <>
                    {controls}
                    <Button size="md" color="primary" iconLeading={Icon} onPress={action.onRun} className={pill}>
                        {action.label}
                    </Button>
                </>
            )}
            {(status === "uploading" || status === "processing") && (
                <Button size="md" color="secondary" iconLeading={X} onPress={job.cancel} className={pill}>
                    {t.common.cancel}
                </Button>
            )}
            {status === "error" && (
                <Button size="md" color="primary" iconLeading={RotateCcw} onPress={action.onRun} className={pill}>
                    {t.common.tryAgain}
                </Button>
            )}
            {status === "unsupported" && (
                <Button size="md" color="secondary" iconLeading={ImagePlus} onPress={onChoose} className={pill}>
                    {t.common.chooseAnother}
                </Button>
            )}
            {status === "success" && result && (
                <>
                    <Button size="md" color="secondary" iconLeading={RotateCcw} onPress={job.reset} className={pill}>
                        {t.common.startOver}
                    </Button>
                    <Button size="md" color="primary" iconLeading={Download} onPress={() => downloadFile(result.url, result.fileName)} className={pill}>
                        {t.common.download}
                    </Button>
                </>
            )}
        </div>
    );
}

function Unsupported({ message }: { message: string }) {
    const t = useT();
    return (
        <div className="flex max-w-md flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[var(--studio-chrome)] text-fg-quaternary shadow-sm">
                <AlertCircle className="size-6" aria-hidden />
            </span>
            <p className="mt-6 text-tile text-primary">{t.workspace.unavailableTitle}</p>
            <p className="mt-2 text-md text-tertiary">{message}</p>
        </div>
    );
}

/** Honest progress: a real percentage while uploading, then an indeterminate state while the model works. */
function BusyOverlay({ job }: { job: Job }) {
    const t = useT();
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!job.startedAt) return;
        const tick = () => setElapsed(Math.floor((Date.now() - (job.startedAt ?? Date.now())) / 1000));
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [job.startedAt]);

    const uploading = job.status === "uploading";
    return (
        <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-neutral-950/25" />
            {/* A soft scan line: the image is being worked on. Stops under reduced motion. */}
            <span aria-hidden className="absolute inset-y-0 w-px animate-[scan_2.4s_var(--ease-in-out)_infinite] bg-white/80 shadow-[0_0_24px_4px_rgb(255_255_255/0.35)] motion-reduce:hidden" />
            <div role="status" className="material relative flex items-center gap-3 rounded-full px-5 py-3 text-sm font-medium text-primary">
                <LoaderCircle className="size-4 animate-spin text-fg-quaternary motion-reduce:animate-none" aria-hidden />
                {uploading ? (
                    <span className="tabular-nums">{t.workspace.uploading(Math.round(job.uploadProgress * 100))}</span>
                ) : (
                    <span>
                        {t.workspace.processing}{elapsed >= 3 && <span className="ml-1.5 text-quaternary tabular-nums">{elapsed}s</span>}
                    </span>
                )}
            </div>
        </div>
    );
}

interface ResultViewProps {
    original: ImageFile;
    result: ProcessedImage;
    size: { width: number; height: number };
    compare?: { beforeLabel: string; afterLabel: string };
    transparentResult?: boolean;
    zoomable?: boolean;
}

function ResultView({ original, result, size, compare, transparentResult, zoomable }: ResultViewProps) {
    const [position, setPosition] = useState(50);
    const [zoom, setZoom] = useState<(typeof ZOOM_LEVELS)[number]>(1);
    const [origin, setOrigin] = useState({ x: 50, y: 50 });

    // Zoomed in, the view follows the pointer so any area can be inspected.
    const follow = (event: PointerEvent<HTMLDivElement>) => {
        if (zoom === 1 || (event.pointerType !== "mouse" && event.type === "pointermove")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setOrigin({
            x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
            y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
        });
    };

    const imageClass = "absolute inset-0 size-full object-contain";

    if (!compare) {
        return (
            <div className="animate-enter relative [--i:-1]" style={size} onPointerMove={follow} onPointerDown={follow}>
                <div className={cn("relative size-full overflow-hidden rounded-xl shadow-canvas", transparentResult && "bg-checkerboard")}>
                    <img
                        src={result.url}
                        alt={result.fileName}
                        className={imageClass}
                        style={zoomable && zoom > 1 ? { transform: `scale(${zoom})`, transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}
                        draggable={false}
                    />
                </div>
                {zoomable && <ZoomControl zoom={zoom} onChange={setZoom} />}
            </div>
        );
    }

    return (
        <div className="animate-enter relative [--i:-1]" style={size} onPointerMove={follow} onPointerDown={follow}>
            <CompareSlider
                value={position}
                onChange={setPosition}
                beforeLabel={compare.beforeLabel}
                afterLabel={compare.afterLabel}
                className="rounded-xl shadow-canvas"
                style={size}
                zoom={zoomable && zoom > 1 ? { scale: zoom, origin } : undefined}
                before={
                    <>
                        {original.mimeType !== "image/jpeg" && <div className="absolute inset-0 bg-checkerboard" />}
                        <img src={original.previewUrl} alt={`${compare.beforeLabel}: ${original.name}`} className={imageClass} draggable={false} />
                    </>
                }
                after={
                    <>
                        {transparentResult && <div className="absolute inset-0 bg-checkerboard" />}
                        <img src={result.url} alt={`${compare.afterLabel}: ${result.fileName}`} className={imageClass} draggable={false} />
                    </>
                }
            />
            {zoomable && <ZoomControl zoom={zoom} onChange={setZoom} />}
        </div>
    );
}

function ZoomControl({ zoom, onChange }: { zoom: (typeof ZOOM_LEVELS)[number]; onChange: (level: (typeof ZOOM_LEVELS)[number]) => void }) {
    const t = useT();
    return (
        <div className="material absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full p-0.5 md:bottom-5">
            <Segmented
                size="sm"
                label={t.workspace.zoom}
                value={zoom}
                onChange={onChange}
                options={ZOOM_LEVELS.map((level) => ({ value: level, label: level === 1 ? t.workspace.fit : `${level}×`, ariaLabel: level === 1 ? t.workspace.fitAria : t.workspace.zoomAria(level) }))}
            />
        </div>
    );
}
