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
import type { ImageFile } from "@/types/image";
import { DropZone } from "./DropZone";
import { formatBytes, formatDimensions } from "./format";
import type { useProcessingJob } from "./useProcessingJob";
import { type AppErrorInfo, errorMessage, useT } from "@/i18n";

type Job = ReturnType<typeof useProcessingJob>;
type Status = Job["status"];

const pill = "press-scale rounded-full before:rounded-full";
const ZOOM_LEVELS = [1, 2, 4] as const;

interface ImageWorkspaceProps {
    original: ImageFile | null;
    job: Job;
    action: { label: string; icon: FC<{ className?: string }>; onRun: () => void };
    /** Settings shown beside the primary action before processing (e.g. scale). */
    controls?: ReactNode;
    compare: { beforeLabel: string; afterLabel: string };
    /** Show the transparency grid behind the result (background removal). */
    transparentResult?: boolean;
    /** Offer zoom levels on the result (upscaling). */
    zoomable?: boolean;
    /** Shown instead of the workspace when the server can't run this tool. */
    unsupportedMessage?: AppErrorInfo | null;
}

/** The AI tools' studio: file bar on top, the photo on a quiet stage, actions along the bottom. */
export function ImageWorkspace({ original, job, action, controls, compare, transparentResult, zoomable, unsupportedMessage }: ImageWorkspaceProps) {
    const t = useT();
    const upload = useImageUpload({ navigateTo: null });
    const clearImage = useImageStore((state) => state.clear);
    const areaRef = useRef<HTMLDivElement>(null);
    const status: Status = unsupportedMessage && job.status !== "success" ? "unsupported" : job.status;
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
                    <StatusBadge status={status} job={job} />
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

            {/* Stage */}
            <div className="studio-stage relative flex h-[min(56svh,520px)] min-h-[20rem] p-4 sm:h-[min(64svh,720px)] sm:min-h-[24rem] sm:p-8">
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

                    {status === "success" && job.result && original && size && (
                        <ResultView original={original} job={job} size={size} compare={compare} transparentResult={transparentResult} zoomable={zoomable} />
                    )}
                </div>
            </div>

            {/* Bottom bar — the one thing to do next. */}
            <div className="studio-line flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t px-3 py-3 sm:px-4">
                <Hint status={status} job={job} uploadError={upload.error} compare={compare} />
                <Actions status={status} job={job} action={action} controls={controls} onChoose={upload.openPicker} />
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

function StatusBadge({ status, job }: { status: Status; job: Job }) {
    if (status === "success" && job.result) {
        return (
            <span className="hidden items-center gap-1.5 rounded-full bg-[var(--seg-track)] px-3 py-1 text-xs font-medium text-secondary tabular-nums sm:flex">
                <Check className="size-3.5 text-success-primary" aria-hidden />
                {formatDimensions(job.result.dimensions)} · {formatBytes(job.result.blob.size)}
            </span>
        );
    }
    return null;
}

function Hint({ status, job, uploadError, compare }: { status: Status; job: Job; uploadError: string | null; compare: ImageWorkspaceProps["compare"] }) {
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
        text = t.workspace.hintSuccess(compare.beforeLabel, compare.afterLabel);
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
    action,
    controls,
    onChoose,
}: {
    status: Status;
    job: Job;
    action: ImageWorkspaceProps["action"];
    controls?: ReactNode;
    onChoose: () => void;
}) {
    const t = useT();
    const Icon = action.icon;
    return (
        <div key={status} className="animate-enter ml-auto flex flex-wrap items-center justify-end gap-2 [--i:-1]">
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
            {status === "success" && job.result && (
                <>
                    <Button size="md" color="secondary" iconLeading={RotateCcw} onPress={job.reset} className={pill}>
                        {t.common.startOver}
                    </Button>
                    <Button size="md" color="primary" iconLeading={Download} onPress={() => downloadFile(job.result!.url, job.result!.fileName)} className={pill}>
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
    job: Job;
    size: { width: number; height: number };
    compare: { beforeLabel: string; afterLabel: string };
    transparentResult?: boolean;
    zoomable?: boolean;
}

function ResultView({ original, job, size, compare, transparentResult, zoomable }: ResultViewProps) {
    const t = useT();
    const [position, setPosition] = useState(50);
    const [zoom, setZoom] = useState<(typeof ZOOM_LEVELS)[number]>(1);
    const [origin, setOrigin] = useState({ x: 50, y: 50 });
    const result = job.result!;

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
            {zoomable && (
                <div className="material absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full p-0.5 md:bottom-5">
                    <Segmented
                        size="sm"
                        label={t.workspace.zoom}
                        value={zoom}
                        onChange={setZoom}
                        options={ZOOM_LEVELS.map((level) => ({ value: level, label: level === 1 ? t.workspace.fit : `${level}×`, ariaLabel: level === 1 ? t.workspace.fitAria : t.workspace.zoomAria(level) }))}
                    />
                </div>
            )}
        </div>
    );
}
