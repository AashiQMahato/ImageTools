import { Split } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PageRangeInput } from "@/features/documents/PageRangeInput";
import { parsePageRanges } from "@/features/documents/pageRanges";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { useT } from "@/i18n";

type Mode = "every" | "ranges";

export function SplitPage() {
    const t = useT();
    const copy = t.documents.split;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const [mode, setMode] = useState<Mode>("every");
    const [ranges, setRanges] = useState("");
    const count = pdf.ready?.sizes.length ?? 0;

    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);
    const parsed = mode === "ranges" && count ? parsePageRanges(ranges, count) : null;
    /** Which output file each page lands in (1-based), for the badges. */
    const fileOf = useMemo(() => {
        const map = new Map<number, number>();
        if (mode === "every") for (let page = 1; page <= count; page++) map.set(page, page);
        else if (parsed?.ok) parsed.ranges.forEach((range, index) => { for (let page = range.start; page <= range.end; page++) if (!map.has(page)) map.set(page, index + 1); });
        return map;
    }, [mode, count, parsed]);
    const outputs = mode === "every" ? count : parsed?.ok ? parsed.ranges.length : 0;

    const split = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("mode", mode);
        if (mode === "ranges") form.append("ranges", ranges);
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/split", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
        setRanges("");
    };

    return (
        <DocumentToolLayout
            tool="pdfSplit"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.mode}</h3>
                        <Segmented label={copy.mode} value={mode} onChange={setMode} options={(["every", "ranges"] as const).map((value) => ({ value, label: copy.modes[value] }))} />
                        {mode === "ranges" ? <PageRangeInput value={ranges} onChange={setRanges} count={count} label={copy.rangesLabel} hint={copy.rangesHint} /> : <p className="text-xs text-tertiary">{copy.everyHint}</p>}
                        {outputs > 0 && <p className="text-sm font-medium text-secondary tabular-nums">{copy.creates(outputs)}</p>}
                    </section>
                </>
            }
            action={{ label: copy.action, icon: Split, onPress: split, disabled: !pdf.ready || outputs === 0 }}
        >
            <SinglePdfWorkspace pdf={pdf}>
                {({ document, sizes }) => (
                    <PageGrid
                        document={document}
                        sizes={sizes}
                        items={items}
                        label={copy.pagesLabel}
                        dimmed={(item) => !fileOf.has(item.page)}
                        badge={(item) => {
                            const file = fileOf.get(item.page);
                            return file ? <span className="rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[0.6875rem] font-semibold text-white tabular-nums shadow-sm">{copy.fileBadge(file)}</span> : null;
                        }}
                    />
                )}
            </SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
