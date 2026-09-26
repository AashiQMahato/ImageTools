import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import type { FrameSize } from "./ImageCanvas";
import type { SelectionInfo } from "./useSelectionMask";

interface ProcessingOverlayProps {
    frame: FrameSize;
    /** The live selection canvas (any resolution; it's drawn scaled to the frame). */
    mask: HTMLCanvasElement;
    bounds: SelectionInfo["bounds"];
    /** "finishing": the result is in — the effect fades away as it's revealed. */
    status: "uploading" | "processing" | "finishing";
    uploadProgress: number;
    startedAt: number | null;
    onCancel?: () => void;
}

/** When each stage's words appear, in seconds; the last stage is kept for the moment the result arrives. */
const STAGE_AT = [0, 1.4, 3.2, 5.5];
/** One pass of the scan over the selection. */
const SWEEP_SECONDS = 1.8;

/**
 * While the server works, the selection is what's lit: the rest of the photo dims, the selected area
 * glows softly and a band of light sweeps across it — only across it. Nothing here claims progress it
 * doesn't have: the ring shows the real upload, then spins; the words narrate what the work involves.
 */
export function ProcessingOverlay({ frame, mask, bounds, status, uploadProgress, startedAt, onCancel }: ProcessingOverlayProps) {
    const t = useT();
    const copy = t.retouch;
    const reduced = usePrefersReducedMotion();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const finishing = status === "finishing";
    const uploading = status === "uploading";

    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!startedAt) return;
        const tick = () => setElapsed((Date.now() - startedAt) / 1000);
        tick();
        const timer = window.setInterval(tick, 250);
        return () => window.clearInterval(timer);
    }, [startedAt]);
    const stage = finishing ? copy.stages.length - 1 : STAGE_AT.reduce((last, at, index) => (elapsed >= at ? index : last), 0);

    useEffect(() => {
        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context || !frame.width) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(frame.width * ratio);
        const height = Math.round(frame.height * ratio);
        canvas.width = width;
        canvas.height = height;

        // The selection at display size, made once — the frame loop only ever draws small surfaces.
        const selection = document.createElement("canvas");
        selection.width = width;
        selection.height = height;
        selection.getContext("2d")!.drawImage(mask, 0, 0, width, height);
        const band = document.createElement("canvas");
        band.width = width;
        band.height = height;
        const bandContext = band.getContext("2d")!;

        const box = bounds ?? { x: 0, y: 0, width: 1, height: 1 };
        const from = (box.y - 0.08) * height;
        const to = (box.y + box.height + 0.08) * height;
        const bandHeight = Math.max(24 * ratio, (to - from) * 0.28);
        const started = performance.now();
        let frameId = 0;

        const draw = (seconds: number) => {
            context.clearRect(0, 0, width, height);
            // Dim the photo outside the selection.
            context.globalCompositeOperation = "source-over";
            context.fillStyle = "rgb(9 9 11 / 0.42)";
            context.fillRect(0, 0, width, height);
            context.globalCompositeOperation = "destination-out";
            context.drawImage(selection, 0, 0);
            // The selection itself, gently breathing.
            context.globalCompositeOperation = "source-over";
            context.globalAlpha = reduced ? 0.4 : 0.3 + 0.12 * Math.sin(seconds * 2.4);
            context.drawImage(selection, 0, 0);
            context.globalAlpha = 1;
            if (reduced) return;

            // A band of light sweeping down, clipped to the selected pixels.
            const phase = (seconds / SWEEP_SECONDS) % 1;
            const y = from - bandHeight + phase * (to - from + bandHeight * 2);
            bandContext.globalCompositeOperation = "source-over";
            bandContext.clearRect(0, 0, width, height);
            const gradient = bandContext.createLinearGradient(0, y - bandHeight, 0, y + bandHeight * 0.15);
            gradient.addColorStop(0, "rgb(255 255 255 / 0)");
            gradient.addColorStop(0.85, "rgb(255 255 255 / 0.55)");
            gradient.addColorStop(1, "rgb(255 255 255 / 0)");
            bandContext.fillStyle = gradient;
            bandContext.fillRect(0, y - bandHeight, width, bandHeight * 1.15);
            bandContext.globalCompositeOperation = "destination-in";
            bandContext.drawImage(selection, 0, 0);
            context.globalCompositeOperation = "lighter";
            context.drawImage(band, 0, 0);
            context.globalCompositeOperation = "source-over";
        };

        const loop = (now: number) => {
            draw((now - started) / 1000);
            frameId = requestAnimationFrame(loop);
        };
        if (reduced) draw(0);
        else frameId = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frameId);
            selection.width = selection.height = band.width = band.height = 0;
        };
    }, [frame.width, frame.height, mask, bounds, reduced]);

    const circumference = 2 * Math.PI * 7;

    return (
        <div aria-busy={!finishing} className={cn("absolute inset-0 transition-opacity duration-500 ease-[var(--ease-out)]", finishing ? "opacity-0" : "retouch-fade-in")}>
            <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />
            <div
                role="status"
                className={cn(
                    "absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-white/15 bg-neutral-950/70 py-1.5 pr-1.5 pl-2 text-xs font-medium text-white shadow-lg backdrop-blur-md",
                    !onCancel && "pr-3.5",
                )}
            >
                <svg viewBox="0 0 18 18" className={cn("size-[1.125rem] shrink-0 -rotate-90", !uploading && "animate-spin motion-reduce:animate-none")} aria-hidden>
                    <circle cx="9" cy="9" r="7" fill="none" stroke="rgb(255 255 255 / 0.2)" strokeWidth="2" />
                    <circle
                        cx="9"
                        cy="9"
                        r="7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={uploading ? circumference * (1 - Math.max(0.04, uploadProgress)) : circumference * 0.72}
                        className="transition-[stroke-dashoffset] duration-200"
                    />
                </svg>
                <span key={stage} className="retouch-stage truncate">
                    {copy.stages[stage]}
                </span>
                {uploading ? (
                    <span className="shrink-0 text-white/55 tabular-nums">{Math.round(uploadProgress * 100)}%</span>
                ) : (
                    elapsed >= 4 && !finishing && <span className="shrink-0 text-white/55 tabular-nums">{Math.floor(elapsed)}s</span>
                )}
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        onPointerDown={(event) => event.stopPropagation()}
                        aria-label={t.common.cancel}
                        className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-full text-white/70 outline-white hover:bg-white/15 hover:text-white focus-visible:outline-2 pointer-coarse:size-9"
                    >
                        <X className="size-3.5" aria-hidden />
                    </button>
                )}
            </div>
        </div>
    );
}
