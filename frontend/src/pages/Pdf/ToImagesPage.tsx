import { FileImage } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PageRangeInput } from "@/features/documents/PageRangeInput";
import { formatPageRanges, parsePageRanges } from "@/features/documents/pageRanges";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { jobFileUrl } from "@/lib/api/jobsApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

type Format = "jpg" | "png" | "webp";
const RESOLUTIONS = [72, 150, 300] as const;
const PREVIEW_LIMIT = 12;

export function ToImagesPage() {
    const t = useT();
    const copy = t.documents.toImages;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const [format, setFormat] = useState<Format>("jpg");
    const [dpi, setDpi] = useState<(typeof RESOLUTIONS)[number]>(150);
    const [quality, setQuality] = useState(85);
    const [scope, setScope] = useState<"all" | "choose">("all");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [ranges, setRanges] = useState("");
    const count = pdf.ready?.sizes.length ?? 0;
    const first = pdf.ready?.sizes[0];

    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);
    // The grid and the typed ranges are two views of one choice.
    const choose = (next: Set<string>) => {
        setSelected(next);
        setRanges(formatPageRanges([...next].map(Number)));
    };
    const type = (value: string) => {
        setRanges(value);
        const parsed = parsePageRanges(value, count);
        if (parsed.ok) setSelected(new Set(parsed.pages.map(String)));
    };
    const chosen = scope === "all" ? count : parsePageRanges(ranges, count).ok ? selected.size : 0;

    const convert = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("format", format);
        form.append("dpi", String(dpi));
        form.append("quality", String(quality));
        if (scope === "choose") form.append("pages", ranges);
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/to-images", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
        setSelected(new Set());
        setRanges("");
        setScope("all");
    };
    const result = job.job;

    return (
        <DocumentToolLayout
            tool="pdfToImages"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            result={
                result && (
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
                        {result.files.slice(0, PREVIEW_LIMIT).map((file) => (
                            <li key={file.id} className="overflow-hidden rounded-lg border border-[var(--card-line)] bg-white">
                                <img src={jobFileUrl(result.id, file.id, true)} alt={file.name} loading="lazy" className="aspect-[3/4] w-full object-contain" />
                            </li>
                        ))}
                    </ul>
                )
            }
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.pages}</h3>
                        <Segmented label={copy.pages} value={scope} onChange={setScope} options={(["all", "choose"] as const).map((value) => ({ value, label: copy.scopes[value] }))} />
                        {scope === "choose" && count > 0 && <PageRangeInput value={ranges} onChange={type} count={count} label={copy.rangesLabel} hint={copy.chooseHint} />}
                    </section>
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.format}</h3>
                        <Segmented label={copy.format} value={format} onChange={setFormat} options={(["jpg", "png", "webp"] as const).map((value) => ({ value, label: value.toUpperCase() }))} />
                        {format !== "png" ? <Range label={copy.quality} value={quality} min={40} max={100} onChange={setQuality} format={(value) => `${value}%`} /> : <p className="text-xs text-tertiary">{copy.pngHint}</p>}
                    </section>
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.resolution}</h3>
                        <div role="radiogroup" aria-label={copy.resolution} className="flex flex-col gap-2">
                            {RESOLUTIONS.map((value) => {
                                const active = dpi === value;
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        onClick={() => setDpi(value)}
                                        className={cn(
                                            "flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left outline-focus-ring transition-colors duration-150 focus-visible:outline-2",
                                            active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--card-line)] hover:bg-primary_hover",
                                        )}
                                    >
                                        <span className={cn("text-sm font-medium", active ? "text-[var(--brand)]" : "text-primary")}>{copy.resolutions[value]}</span>
                                        {first && <span className="text-xs text-tertiary tabular-nums">{copy.pixels(Math.round((first.width / 72) * value), Math.round((first.height / 72) * value))}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </>
            }
            action={{ label: chosen ? copy.action(chosen) : copy.actionNone, icon: FileImage, onPress: convert, disabled: !pdf.ready || chosen === 0 }}
        >
            <SinglePdfWorkspace pdf={pdf}>
                {({ document, sizes }) => (
                    <PageGrid
                        document={document}
                        sizes={sizes}
                        items={items}
                        label={copy.gridLabel}
                        selected={scope === "choose" ? selected : null}
                        onSelectedChange={choose}
                        dimmed={(item) => scope === "choose" && !selected.has(item.key)}
                    />
                )}
            </SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
