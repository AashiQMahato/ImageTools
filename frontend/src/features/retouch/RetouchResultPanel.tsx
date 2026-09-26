import { Check, Download, LoaderCircle, X } from "lucide-react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import type { ExportFormat } from "@/features/image-processing/exportFormat";
import { formatBytes, formatDimensions } from "@/features/image-processing/format";
import { FormatPicker } from "@/features/image-processing/FormatPicker";
import type { ProcessedImage } from "@/types/image";
import { useT } from "@/i18n";
import type { CompareMode } from "./BeforeAfterComparison";

/** Shown while a result waits: how to compare it, and the two ways forward. */
export function RetouchResultPanel({ compare, onCompareChange, onAccept, onDiscard }: { compare: CompareMode; onCompareChange: (mode: CompareMode) => void; onAccept: () => void; onDiscard: () => void }) {
    const t = useT();
    const copy = t.retouch;
    return (
        <section className="animate-enter flex flex-col gap-4 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] p-4 [--i:-1]">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Check className="size-4 text-[var(--brand)]" aria-hidden />
                    {copy.resultTitle}
                </h3>
                <p className="mt-1 text-xs text-tertiary">{copy.resultHint}</p>
            </div>
            <Segmented
                size="sm"
                label={copy.compareLabel}
                value={compare}
                onChange={onCompareChange}
                className="w-full bg-primary [&>button]:flex-1"
                options={(["slider", "split", "toggle"] as const).map((value) => ({ value, label: copy.compareModes[value] }))}
            />
            <div className="grid grid-cols-2 gap-2">
                <Button size="md" color="secondary" iconLeading={X} onPress={onDiscard} className="press-scale pointer-coarse:min-h-11">
                    {copy.discard}
                </Button>
                <Button size="md" color="primary" iconLeading={Check} onPress={onAccept} className="press-scale pointer-coarse:min-h-11">
                    {copy.accept}
                </Button>
            </div>
        </section>
    );
}

interface ExportControlsProps {
    /** What would be downloaded, in the chosen format; null until something has been retouched. */
    image: ProcessedImage | null;
    format: ExportFormat;
    onFormatChange: (format: ExportFormat) => void;
    /** A format conversion is in flight. */
    working: boolean;
    /** Briefly true after a download started, for the button's confirmation. */
    downloaded: boolean;
    mayHaveAlpha: boolean;
    onDownload: () => void;
}

export function ExportControls({ image, format, onFormatChange, working, downloaded, mayHaveAlpha, onDownload }: ExportControlsProps) {
    const t = useT();
    const copy = t.retouch;
    return (
        <div className="flex flex-col gap-4">
            <FormatPicker value={format} onChange={onFormatChange} note={format === "jpeg" && mayHaveAlpha ? t.workspace.flattensAlpha : undefined} />
            <p className="flex min-h-4 items-center gap-2 text-xs text-tertiary tabular-nums">
                {working && <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />}
                {image ? (working ? t.pages.upscale.converting : `${formatDimensions(image.dimensions)} · ${t.workspace.formatNames[format]} · ${formatBytes(image.blob.size)}`) : copy.exportEmpty}
            </p>
            <Button size="lg" color="primary" iconLeading={downloaded ? Check : Download} onPress={onDownload} isDisabled={!image || working} className="press-scale w-full pointer-coarse:min-h-12">
                {downloaded ? copy.downloaded : copy.downloadImage}
            </Button>
        </div>
    );
}
