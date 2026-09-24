import { AlertCircle, Download, ImagePlus, LoaderCircle, RotateCcw, X } from "lucide-react";
import { type FC, type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { CompareSlider } from "@/components/common/CompareSlider";
import { Button } from "@/components/ui/base/buttons/button";
import { useFitSize } from "@/hooks/useFitSize";
import { useImageUpload } from "@/hooks/useImageUpload";
import { UPLOAD_HINT } from "@/lib/constants/upload";
import { cn } from "@/lib/utils/cn";
import { downloadFile } from "@/lib/utils/download";
import type { ImageFile } from "@/types/image";
import { formatBytes, formatDimensions } from "./format";
import type { useProcessingJob } from "./useProcessingJob";

type Job = ReturnType<typeof useProcessingJob>;

const pill = "press-scale rounded-full before:rounded-full";
const ZOOM_LEVELS = [1, 2, 4] as const;

interface ImageWorkspaceProps {
    original: ImageFile | null;
    job: Job;
    action: { label: string; icon: FC<{ className?: string }>; onRun: () => void };
    /** Extra controls shown next to the primary action before processing (e.g. scale). */
    controls?: ReactNode;
    compare: { beforeLabel: string; afterLabel: string };
    /** Show the transparency grid behind the result (background removal). */
    transparentResult?: boolean;
    /** Offer zoom levels on the result (upscaling). */
    zoomable?: boolean;
    /** Shown instead of the workspace when the server can't run this tool. */
    unsupportedMessage?: string | null;
}

export function ImageWorkspace({ original, job, action, controls, compare, transparentResult, zoomable, unsupportedMessage }: ImageWorkspaceProps) {
    const upload = useImageUpload({ navigateTo: null });
    const areaRef = useRef<HTMLDivElement>(null);
    const status = unsupportedMessage && job.status !== "success" ? "unsupported" : job.status;
    const dimensions = job.result?.dimensions ?? original?.dimensions ?? null;
    const size = useFitSize(areaRef, dimensions ? dimensions.width / dimensions.height : null);
    const busy = status === "uploading" || status === "processing";

    return (
        <div>
            <div className="tile relative flex h-[min(72svh,780px)] min-h-[26rem] flex-col overflow-hidden">
                <div ref={areaRef} className="relative mx-4 mt-4 mb-24 flex flex-1 items-center justify-center md:mx-8 md:mt-8 md:mb-28">
                    {status === "idle" && <DropZone onChoose={upload.openPicker} />}

                    {status === "unsupported" && <Unsupported message={unsupportedMessage ?? job.error ?? ""} />}

                    {original && status !== "idle" && status !== "success" && status !== "unsupported" && size && (
                        <figure
                            className={cn(
                                "animate-enter relative overflow-hidden rounded-2xl shadow-canvas [--i:-1]",
                                original.mimeType !== "image/jpeg" && "bg-checkerboard",
                            )}
                            style={size}
                        >
                            <img src={original.previewUrl} alt={`Selected image: ${original.name}`} className="size-full object-contain" draggable={false} />
                            {busy && <BusyOverlay job={job} />}
                        </figure>
                    )}

                    {status === "success" && job.result && original && size && (
                        <ResultView original={original} job={job} size={size} compare={compare} transparentResult={transparentResult} zoomable={zoomable} />
                    )}
                </div>

                <div className="absolute inset-x-0 bottom-4 flex justify-center px-4 md:bottom-6">
                    <Toolbar status={status} job={job} action={action} controls={controls} onReplace={upload.openPicker} hasImage={Boolean(original)} />
                </div>
                <input {...upload.inputProps} aria-hidden />
            </div>

            <MetaRow original={original} job={job} status={status} uploadError={upload.error} />
        </div>
    );
}

function DropZone({ onChoose }: { onChoose: () => void }) {
    return (
        <button
            type="button"
            onClick={onChoose}
            className={cn(
                "group flex size-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/70 px-6 text-center",
                "transition-[border-color,background-color] duration-300 hover:border-[var(--color-focus-ring)] hover:bg-primary/40",
                "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4",
            )}
        >
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-fg-primary shadow-md transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-translate-y-1">
                <ImagePlus className="size-7" aria-hidden />
            </span>
            {/* Touch devices can't drag files in, so they get "choose" wording instead of "drop". */}
            <span className="mt-6 text-tile text-primary [@media(hover:none)]:hidden">Drop an image here</span>
            <span className="mt-6 hidden text-tile text-primary [@media(hover:none)]:inline">Choose an image</span>
            <span className="mt-2 text-md text-tertiary [@media(hover:none)]:hidden">
                or <span className="font-medium text-[var(--accent)]">choose a file</span> · you can also paste
            </span>
            <span className="mt-2 hidden text-md text-tertiary [@media(hover:none)]:inline">from your photos or files</span>
            <span className="mt-6 text-sm text-quaternary">{UPLOAD_HINT}</span>
        </button>
    );
}

function Unsupported({ message }: { message: string }) {
    return (
        <div className="flex max-w-md flex-col items-center text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-fg-quaternary shadow-sm">
                <AlertCircle className="size-6" aria-hidden />
            </span>
            <p className="mt-6 text-tile text-primary">Not available right now</p>
            <p className="mt-2 text-md text-tertiary">{message}</p>
        </div>
    );
}

/** Honest progress: a real percentage while uploading, then an indeterminate state while the model works. */
function BusyOverlay({ job }: { job: Job }) {
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
            <div className="absolute inset-0 bg-neutral-950/30 transition-opacity duration-500" />
            {/* A soft scan line: the image is being worked on. Stops under reduced motion. */}
            <span aria-hidden className="absolute inset-y-0 w-px animate-[scan_2.4s_var(--ease-in-out)_infinite] bg-white/80 shadow-[0_0_24px_4px_rgb(255_255_255/0.35)] motion-reduce:hidden" />
            <div role="status" className="material relative flex items-center gap-3 rounded-full px-5 py-3 text-sm font-medium text-primary">
                <LoaderCircle className="size-4 animate-spin text-fg-quaternary motion-reduce:animate-none" aria-hidden />
                {uploading ? (
                    <span className="tabular-nums">Uploading… {Math.round(job.uploadProgress * 100)}%</span>
                ) : (
                    <span>
                        Processing your image…{elapsed >= 3 && <span className="ml-1.5 text-quaternary tabular-nums">{elapsed}s</span>}
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
                className="rounded-2xl shadow-canvas"
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
                <div role="radiogroup" aria-label="Zoom" className="material absolute top-3 left-1/2 flex -translate-x-1/2 rounded-full p-1 md:top-5">
                    {ZOOM_LEVELS.map((level) => (
                        <button
                            key={level}
                            type="button"
                            role="radio"
                            aria-checked={zoom === level}
                            onClick={() => setZoom(level)}
                            className={cn(
                                "min-h-9 min-w-11 cursor-pointer rounded-full px-3 text-sm font-medium tabular-nums transition-colors duration-200",
                                "outline-focus-ring focus-visible:outline-2",
                                zoom === level ? "bg-brand-solid text-primary_on-brand" : "text-secondary hover:text-primary",
                            )}
                        >
                            {level === 1 ? "Fit" : `${level}×`}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

interface ToolbarProps {
    status: string;
    job: Job;
    action: ImageWorkspaceProps["action"];
    controls?: ReactNode;
    onReplace: () => void;
    hasImage: boolean;
}

function Toolbar({ status, job, action, controls, onReplace, hasImage }: ToolbarProps) {
    if (status === "idle") return null;
    const Icon = action.icon;
    const replace = (
        <Button size="lg" color="tertiary" iconLeading={ImagePlus} onPress={onReplace} className={pill} aria-label="Choose another image">
            <span className="hidden sm:inline">{hasImage ? "Replace" : "Choose image"}</span>
        </Button>
    );

    return (
        <div key={status} className="material animate-enter flex max-w-full items-center gap-1 rounded-full p-1.5 [--i:-1]">
            {status === "selected" && (
                <>
                    {replace}
                    {controls}
                    <Button size="lg" color="primary" iconLeading={Icon} onPress={action.onRun} className={pill}>
                        {action.label}
                    </Button>
                </>
            )}

            {(status === "uploading" || status === "processing") && (
                <Button size="lg" color="tertiary" iconLeading={X} onPress={job.cancel} className={pill}>
                    Cancel
                </Button>
            )}

            {status === "error" && (
                <>
                    {replace}
                    <Button size="lg" color="primary" iconLeading={RotateCcw} onPress={action.onRun} className={pill}>
                        Try again
                    </Button>
                </>
            )}

            {status === "unsupported" && replace}

            {status === "success" && job.result && (
                <>
                    {replace}
                    <Button size="lg" color="primary" iconLeading={Download} onPress={() => downloadFile(job.result!.url, job.result!.fileName)} className={pill}>
                        Download
                    </Button>
                </>
            )}
        </div>
    );
}

function MetaRow({ original, job, status, uploadError }: { original: ImageFile | null; job: Job; status: string; uploadError: string | null }) {
    return (
        <div className="mt-4 flex min-h-6 flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1 text-sm">
            {original ? (
                <p className="min-w-0 truncate text-tertiary">
                    <span className="font-medium text-secondary">{original.name}</span>
                    <span className="mx-2 text-quaternary">·</span>
                    <span className="tabular-nums">{formatDimensions(original.dimensions)}</span>
                    <span className="mx-2 text-quaternary">·</span>
                    <span className="tabular-nums">{formatBytes(original.size)}</span>
                </p>
            ) : (
                <span />
            )}

            {uploadError && <p className="text-error-primary">{uploadError}</p>}
            {!uploadError && status === "error" && job.error && <p className="text-error-primary">{job.error}</p>}
            {!uploadError && status === "success" && job.result && (
                <p className="text-tertiary tabular-nums">
                    Result <span className="font-medium text-secondary">{formatDimensions(job.result.dimensions)}</span>
                    <span className="mx-2 text-quaternary">·</span>
                    {formatBytes(job.result.blob.size)}
                </p>
            )}
        </div>
    );
}
