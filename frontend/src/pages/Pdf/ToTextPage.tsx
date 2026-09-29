import { FileType } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { TextResult } from "@/features/documents/TextResult";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { baseName } from "@/features/image-processing/format";
import type { OcrLanguage } from "@/lib/api/ocrApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

type Mode = "auto" | "text" | "ocr";

export function ToTextPage() {
    const t = useT();
    const copy = t.documents.toText;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const [mode, setMode] = useState<Mode>("auto");
    const [language, setLanguage] = useState<OcrLanguage>("auto");
    const count = pdf.ready?.sizes.length ?? 0;
    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);

    const extract = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("mode", mode);
        form.append("language", language);
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/to-text", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
    };

    return (
        <DocumentToolLayout
            tool="pdfToText"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            resultView={job.job && <TextResult job={job.job} name={baseName(pdf.file?.name ?? "document")} onStartOver={startOver} />}
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.mode}</h3>
                        <div role="radiogroup" aria-label={copy.mode} className="flex flex-col gap-2">
                            {(["auto", "text", "ocr"] as const).map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={mode === value}
                                    onClick={() => setMode(value)}
                                    className={cn(
                                        "flex min-h-14 cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 text-left outline-focus-ring transition-colors duration-150 focus-visible:outline-2",
                                        mode === value ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--card-line)] hover:bg-primary_hover",
                                    )}
                                >
                                    <span className={cn("text-sm font-semibold", mode === value ? "text-[var(--brand)]" : "text-primary")}>{copy.modes[value].title}</span>
                                    <span className="text-xs text-tertiary">{copy.modes[value].description}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                    {mode !== "text" && (
                        <section className="flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-primary">{t.ocr.languageLabel}</h3>
                            <Segmented label={t.ocr.languageLabel} value={language} onChange={setLanguage} options={(["auto", "en", "ne", "mixed"] as const).map((value) => ({ value, label: t.ocr.languages[value] }))} scrollable />
                        </section>
                    )}
                </>
            }
            action={{ label: copy.action, icon: FileType, onPress: extract, disabled: !pdf.ready }}
        >
            <SinglePdfWorkspace pdf={pdf}>{({ document, sizes }) => <PageGrid document={document} sizes={sizes} items={items} label={copy.gridLabel} />}</SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
