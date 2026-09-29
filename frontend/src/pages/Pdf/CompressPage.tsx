import { FileArchive } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { formatBytes } from "@/features/image-processing/format";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

type Preset = "maximum" | "recommended" | "high" | "custom";
const SIDES = [1200, 1800, 2600, 4000] as const;

export function CompressPage() {
    const t = useT();
    const copy = t.documents.compress;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const [preset, setPreset] = useState<Preset>("recommended");
    const [quality, setQuality] = useState(70);
    const [maxSide, setMaxSide] = useState<(typeof SIDES)[number]>(1800);
    const count = pdf.ready?.sizes.length ?? 0;
    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);

    const compress = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("preset", preset);
        form.append("quality", String(quality));
        form.append("maxSide", String(maxSide));
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/compress", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
    };

    // The numbers the server measured — nothing estimated.
    const summary = job.job?.summary;
    const before = summary?.before ?? 0;
    const after = summary?.after ?? 0;
    const saved = before ? Math.round((1 - after / before) * 100) : 0;

    return (
        <DocumentToolLayout
            tool="pdfCompress"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            doneTitle={summary?.smaller ? copy.done : copy.alreadySmall}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            result={
                summary && (
                    <div className="flex flex-col items-center gap-1 rounded-2xl border border-[var(--card-line)] bg-primary px-4 py-5 text-center">
                        <p className="text-2xl font-semibold text-primary tabular-nums">
                            {formatBytes(before)} <span className="text-quaternary">→</span> {formatBytes(after)}
                        </p>
                        <p className={cn("text-sm font-medium tabular-nums", summary.smaller ? "text-success-primary" : "text-tertiary")}>{summary.smaller ? copy.smaller(saved) : copy.notSmaller}</p>
                        {summary.images ? <p className="text-xs text-tertiary">{copy.images(summary.recompressed ?? 0, summary.images)}</p> : null}
                    </div>
                )
            }
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    {pdf.file && <p className="-mt-4 text-xs text-tertiary tabular-nums">{copy.currentSize(formatBytes(pdf.file.size))}</p>}
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.level}</h3>
                        <div role="radiogroup" aria-label={copy.level} className="flex flex-col gap-2">
                            {(["maximum", "recommended", "high", "custom"] as const).map((value) => {
                                const active = preset === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setPreset(value)}
                                        className={cn(
                                            "flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-left outline-focus-ring transition-colors duration-150 focus-visible:outline-2",
                                            active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--card-line)] hover:bg-primary_hover",
                                        )}
                                    >
                                        <span className={cn("text-sm font-semibold", active ? "text-[var(--brand)]" : "text-primary")}>{copy.presets[value].title}</span>
                                        <span className="text-xs text-tertiary">{copy.presets[value].description}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {preset === "custom" && (
                            <div className="animate-enter flex flex-col gap-3 [--i:-1]">
                                <Range label={copy.quality} value={quality} min={20} max={100} onChange={setQuality} format={(value) => `${value}%`} />
                                <span className="text-xs font-medium text-secondary">{copy.maxSide}</span>
                                <Segmented label={copy.maxSide} value={maxSide} onChange={setMaxSide} options={SIDES.map((value) => ({ value, label: `${value} px` }))} scrollable />
                            </div>
                        )}
                        <p className="text-xs text-tertiary">{copy.honest}</p>
                    </section>
                </>
            }
            action={{ label: copy.action, icon: FileArchive, onPress: compress, disabled: !pdf.ready }}
        >
            <SinglePdfWorkspace pdf={pdf}>{({ document, sizes }) => <PageGrid document={document} sizes={sizes} items={items} label={copy.gridLabel} />}</SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
