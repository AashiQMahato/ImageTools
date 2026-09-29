import { Hash } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { measureStamp, type NumberPosition, numberCentre } from "@/features/documents/stampLayout";
import { PositionPicker, StampOverlay, StampText } from "@/features/documents/StampPreview";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { PageScopeControl } from "@/features/documents/PageScopeControl";
import { usePageScope } from "@/features/documents/usePageScope";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

const SPOTS = ["top-left", "top", "top-right", "bottom-left", "bottom", "bottom-right"] as const;
type Format = "plain" | "page" | "fraction" | "full";
const INK = "#1a1a1a";

const fill = (template: string, n: number, total: number) => template.replaceAll("{n}", String(n)).replaceAll("{total}", String(total));

export function PageNumbersPage() {
    const t = useT();
    const copy = t.documents.pageNumbers;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const count = pdf.ready?.sizes.length ?? 0;
    const pages = usePageScope(count);
    const [position, setPosition] = useState<NumberPosition>("bottom");
    const [format, setFormat] = useState<Format>("page");
    const [fontSize, setFontSize] = useState(11);
    const [margin, setMargin] = useState(30);
    const [start, setStart] = useState(1);
    const startId = useId();

    const template = copy.formats[format];
    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);
    // Each numbered page's number: counting from `start` over the chosen pages only.
    const numbers = useMemo(() => {
        const map = new Map<number, number>();
        let next = start;
        for (let page = 1; page <= count; page++) if (pages.includes(page)) map.set(page, next++);
        return map;
    }, [count, pages, start]);
    const total = start + numbers.size - 1;

    const apply = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("position", position);
        form.append("template", template);
        form.append("fontSize", String(fontSize));
        form.append("margin", String(margin));
        form.append("start", String(start));
        if (pages.param) form.append("pages", pages.param);
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/page-numbers", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
        pages.reset();
    };

    return (
        <DocumentToolLayout
            tool="pdfPageNumbers"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            action={{ label: copy.action(pages.count), icon: Hash, onPress: apply, disabled: !pdf.ready || !pages.valid || pages.count === 0 }}
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.format}</h3>
                        <div role="radiogroup" aria-label={copy.format} className="grid grid-cols-2 gap-2">
                            {(Object.keys(copy.formats) as Format[]).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={format === value}
                                    onClick={() => setFormat(value)}
                                    className={cn(
                                        "min-h-11 cursor-pointer rounded-xl border px-3 text-sm font-medium tabular-nums outline-focus-ring transition-colors duration-150 focus-visible:outline-2",
                                        format === value ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--card-line)] text-secondary hover:bg-primary_hover",
                                    )}
                                >
                                    {fill(copy.formats[value], start, Math.max(start, total))}
                                </button>
                            ))}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.position}</h3>
                        <PositionPicker value={position} onChange={setPosition} spots={SPOTS} label={copy.position} names={t.documents.watermark.positions} />
                        <Range label={copy.size} value={fontSize} min={8} max={24} onChange={setFontSize} format={(value) => `${value} pt`} />
                        <Range label={copy.margin} value={margin} min={18} max={72} onChange={setMargin} format={(value) => copy.marginValue(Math.round((value * 25.4) / 72))} />
                        <label htmlFor={startId} className="flex items-center justify-between gap-3 text-xs font-medium text-secondary">
                            {copy.start}
                            <input
                                id={startId}
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={100000}
                                value={start}
                                onChange={(event) => setStart(Math.max(0, Math.min(100000, Math.round(Number(event.target.value) || 0))))}
                                className="h-9 w-24 rounded-lg border border-[var(--card-line)] bg-primary px-2 text-right text-sm text-primary tabular-nums outline-focus-ring focus-visible:outline-2 pointer-coarse:h-11"
                            />
                        </label>
                    </section>
                    <PageScopeControl scope={pages} pageCount={count} label={copy.pages} rangesLabel={copy.rangesLabel} />
                </>
            }
        >
            <SinglePdfWorkspace pdf={pdf}>
                {({ document, sizes }) => (
                    <PageGrid
                        document={document}
                        sizes={sizes}
                        items={items}
                        label={copy.gridLabel}
                        {...pages.grid}
                        overlay={(item, _index, page) => {
                            const number = numbers.get(item.page);
                            if (number === undefined) return null;
                            const label = fill(template, number, total);
                            const stamp = measureStamp(label, fontSize, false);
                            return (
                                <StampOverlay page={page} centres={[numberCentre(page, stamp, position, margin)]} size={stamp} rotation={0} opacity={1}>
                                    <StampText text={label} size={fontSize} pageWidth={page.width} font={stamp.font} color={INK} />
                                </StampOverlay>
                            );
                        }}
                    />
                )}
            </SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
