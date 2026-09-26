import { Download, LoaderCircle, PencilLine } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/base/buttons/button";
import { type ExportFormat, formatOf } from "@/features/image-processing/exportFormat";
import { formatDimensions } from "@/features/image-processing/format";
import { FormatPicker } from "@/features/image-processing/FormatPicker";
import { useT } from "@/i18n";
import { isTransparent } from "./backgrounds";
import { drawComposition } from "./composition";
import type { EditorDoc } from "./document";

interface ExportPanelProps {
    doc: EditorDoc;
    subject: HTMLCanvasElement | null;
    photo: ImageBitmap | null;
    /** Changes whenever the subject's pixels do, so the preview keeps up with brush edits. */
    revision: number;
    format: ExportFormat;
    onFormatChange: (format: ExportFormat) => void;
    quality: number;
    onQualityChange: (quality: number) => void;
    exporting: boolean;
    error: string | null;
    onDownload: () => void;
    onContinue: () => void;
}

/** The last step: a true preview of the file, how to save it, and the download itself. */
export function ExportPanel({ doc, subject, photo, revision, format, onFormatChange, quality, onQualityChange, exporting, error, onDownload, onContinue }: ExportPanelProps) {
    const t = useT();
    const copy = t.bgEditor;
    const previewRef = useRef<HTMLCanvasElement>(null);
    const qualityId = useId();
    const transparent = isTransparent(doc.background);
    const lossy = formatOf(format).id !== "png";

    // The preview is the export itself, drawn smaller — not a CSS approximation of it.
    useEffect(() => {
        const element = previewRef.current;
        if (!element || !subject) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.round(280 * ratio);
        element.width = width;
        element.height = Math.round((width * subject.height) / subject.width);
        const ctx = element.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, element.width, element.height);
        drawComposition(ctx, doc, subject, photo, element.width, element.height, !formatOf(format).alpha);
    }, [doc, subject, photo, revision, format]);

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-sm font-semibold text-primary">{copy.exportTitle}</h3>
                <p className="mt-0.5 text-xs text-tertiary">{copy.exportHint}</p>
            </div>

            <div className={transparent && formatOf(format).alpha ? "bg-checkerboard overflow-hidden rounded-xl border border-[var(--card-line)]" : "overflow-hidden rounded-xl border border-[var(--card-line)]"}>
                <canvas ref={previewRef} role="img" aria-label={copy.exportPreview} className="block h-auto w-full" />
            </div>
            {subject && (
                <p className="-mt-3 text-xs text-tertiary tabular-nums">
                    {formatDimensions({ width: subject.width, height: subject.height })} · {t.workspace.formatNames[format]}
                </p>
            )}

            <FormatPicker
                value={format}
                onChange={onFormatChange}
                unavailable={transparent ? { jpeg: copy.jpgNeedsBackground } : undefined}
                note={format === "png" ? (transparent ? copy.pngNote : copy.pngOpaqueNote) : undefined}
            />

            {lossy && (
                <div>
                    <label htmlFor={qualityId} className="flex justify-between text-xs font-medium text-secondary">
                        {copy.quality}
                        <span className="text-tertiary tabular-nums">{Math.round(quality * 100)}</span>
                    </label>
                    <input
                        id={qualityId}
                        type="range"
                        min={50}
                        max={100}
                        value={Math.round(quality * 100)}
                        onChange={(event) => onQualityChange(Number(event.target.value) / 100)}
                        className="mt-2 w-full accent-[var(--tool-solid)] pointer-coarse:h-8"
                    />
                </div>
            )}

            <div className="flex flex-col gap-2">
                <Button size="lg" color="primary" onPress={onDownload} isDisabled={!subject || exporting} className="press-scale w-full pointer-coarse:min-h-12">
                    <span className="flex items-center gap-2">
                        {exporting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Download className="size-4" aria-hidden />}
                        {exporting ? copy.preparingDownload : copy.downloadImage}
                    </span>
                </Button>
                <Button size="md" color="tertiary" iconLeading={PencilLine} onPress={onContinue} className="press-scale w-full pointer-coarse:min-h-11">
                    {copy.backToEditing}
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-xs text-error-primary">
                    {error}
                </p>
            )}
        </div>
    );
}
