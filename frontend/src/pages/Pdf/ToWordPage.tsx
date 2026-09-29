import { FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { WordResult } from "@/features/documents/WordResult";
import { baseName } from "@/features/image-processing/format";
import type { OcrLanguage } from "@/lib/api/ocrApi";
import { useT } from "@/i18n";

export function ToWordPage() {
    const t = useT();
    const copy = t.documents.toWord;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const [language, setLanguage] = useState<OcrLanguage>("auto");
    const count = pdf.ready?.sizes.length ?? 0;
    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);

    const convert = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("language", language);
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/to-word", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
    };

    return (
        <DocumentToolLayout
            tool="pdfToWord"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            resultView={job.job && <WordResult job={job.job} name={baseName(pdf.file?.name ?? "document")} onStartOver={startOver} />}
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.language}</h3>
                        <Segmented label={copy.language} value={language} onChange={setLanguage} options={(["auto", "en", "ne", "mixed"] as const).map((value) => ({ value, label: t.ocr.languages[value] }))} scrollable />
                        <p className="text-xs text-tertiary">{copy.languageHint}</p>
                    </section>
                    <section className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold text-primary">{copy.keeps}</h3>
                        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs leading-relaxed text-secondary">
                            {copy.kept.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                        <p className="text-xs leading-relaxed text-tertiary">{copy.approximate}</p>
                    </section>
                </>
            }
            action={{ label: copy.action, icon: FileText, onPress: convert, disabled: !pdf.ready }}
        >
            <SinglePdfWorkspace pdf={pdf}>{({ document, sizes }) => <PageGrid document={document} sizes={sizes} items={items} label={copy.gridLabel} />}</SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
