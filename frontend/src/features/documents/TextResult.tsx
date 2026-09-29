import { Copy, FileDown, FilePenLine, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { openInTextEditor } from "@/features/text/textDocument";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { fetchJobFile, type Job } from "@/lib/api/jobsApi";
import { ROUTES } from "@/lib/constants/routes";
import { downloadFile } from "@/lib/utils/download";
import { useT } from "@/i18n";
import { ExportDialog, type ExportFormat } from "./ExportDialog";
import { textToDocx, textToPdf } from "./textExport";

type TextFormat = "txt" | "docx" | "pdf";

type Method = "text" | "ocr" | "none";

interface PageText {
    page: number;
    method: Method;
    text: string;
    alternative?: { method: Method; text: string };
    reason?: "scan" | "legacy-font" | "mismatch";
    note?: "empty" | "unavailable";
}

const DEVANAGARI = /[ऀ-ॿ]/;

/**
 * The extracted text, page by page — editable, with where each page's text came from (the PDF's own
 * text or OCR) and, when both exist, a switch between them. Exports use the text as edited.
 */
export function TextResult({ job, name, onStartOver }: { job: Job; name: string; onStartOver: () => void }) {
    const t = useT();
    const copy = t.documents.toText;
    const [pages, setPages] = useState<PageText[] | null>(null);
    const [failed, setFailed] = useState(false);
    const [chosen, setChosen] = useState<Record<number, Method>>({});
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [notice, setNotice] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const navigate = useNavigate();
    const formats: ExportFormat<TextFormat>[] = [
        { value: "txt", label: t.ocr.export.txt, extension: "txt" },
        { value: "docx", label: t.ocr.export.docx, extension: "docx" },
        { value: "pdf", label: t.ocr.export.pdf, extension: "pdf", prints: true, hint: t.ocr.export.pdfHint },
    ];

    useEffect(() => {
        const file = job.files.find((candidate) => candidate.mimeType.startsWith("application/json"));
        if (!file) return;
        const controller = new AbortController();
        void fetchJobFile(job.id, file.id, controller.signal)
            .then((blob) => blob.text())
            .then((body) => setPages((JSON.parse(body) as { pages: PageText[] }).pages))
            .catch(() => !controller.signal.aborted && setFailed(true));
        return () => controller.abort();
    }, [job]);

    const current = (page: PageText) => {
        const method = chosen[page.page] ?? page.method;
        const reading = method === page.method ? page.text : (page.alternative?.text ?? "");
        return { method, text: edits[`${page.page}:${method}`] ?? reading };
    };
    const texts = useMemo(() => (pages ?? []).map((page) => current(page).text), [pages, chosen, edits]); // eslint-disable-line react-hooks/exhaustive-deps
    const all = texts.join("\n\n");
    const lang = DEVANAGARI.test(all) ? "ne" : "en";
    const stats = pages ? { text: pages.filter((page) => current(page).method === "text").length, ocr: pages.filter((page) => current(page).method === "ocr").length } : null;

    const save = (blob: Blob, fileName: string) => {
        const url = URL.createObjectURL(blob);
        downloadFile(url, fileName);
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
        setNotice(t.documents.result.downloadFile(fileName));
    };

    if (failed) return <p className="py-10 text-center text-sm text-error-primary">{t.errors.GENERIC}</p>;
    if (!pages) return <p className="py-10 text-center text-sm text-tertiary">{t.documents.errors.loading}</p>;

    return (
        <div className="animate-enter mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 [--i:-1] sm:py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-primary">{copy.ready}</h2>
                    {stats && <p className="text-sm text-tertiary tabular-nums">{copy.summary(pages.length, stats.text, stats.ocr)}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button size="md" color="secondary" iconLeading={Copy} onPress={() => void navigator.clipboard.writeText(all).then(() => setNotice(t.ocr.export.copied), () => setNotice(t.ocr.export.copyFailed))}>
                        {copy.copy}
                    </Button>
                    <Button size="md" color="primary" iconLeading={FileDown} onPress={() => setExporting(true)}>
                        {t.documents.exportDialog.export}
                    </Button>
                </div>
            </div>
            {notice && (
                <p role="status" className="text-xs text-success-primary">
                    {notice}
                </p>
            )}
            <ExportDialog
                open={exporting}
                onClose={() => setExporting(false)}
                title={t.documents.exportDialog.title}
                formats={formats}
                name={name}
                pageCount={pages.length}
                onExport={async ({ format, fileName, baseName, pages: chosen }) => {
                    const selected = chosen ? texts.filter((_, index) => chosen.includes(index + 1)) : texts;
                    if (format === "txt") save(new Blob([selected.join("\n\n").replace(/\n/g, "\r\n")], { type: "text/plain;charset=utf-8" }), fileName);
                    else if (format === "docx") save(await textToDocx(selected, baseName), fileName);
                    else await textToPdf(selected, baseName, lang);
                }}
            />
            <ol className="flex flex-col gap-4">
                {pages.map((page) => {
                    const { method, text } = current(page);
                    const origin = method === "text" ? copy.fromText : method === "ocr" ? copy.fromOcr : copy.noText;
                    return (
                        <li key={page.page} className="rounded-2xl border border-[var(--card-line)] bg-primary">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--card-line)] px-3 py-2">
                                <span className="text-sm font-semibold text-primary">
                                    {copy.page(page.page)} <span className="font-normal text-tertiary">· {origin}</span>
                                </span>
                                {page.alternative && page.alternative.method !== page.method && (
                                    <Segmented
                                        size="sm"
                                        label={copy.source}
                                        value={method}
                                        onChange={(value) => setChosen((all_) => ({ ...all_, [page.page]: value }))}
                                        options={[page.method, page.alternative.method].map((value) => ({ value, label: value === "text" ? copy.sources.text : copy.sources.ocr }))}
                                    />
                                )}
                            </div>
                            {(page.reason || page.note) && method === page.method && <p className="px-3 pt-2 text-xs text-tertiary">{page.note ? copy.notes[page.note] : copy.reasons[page.reason!]}</p>}
                            <textarea
                                value={text}
                                onChange={(event) => setEdits((all_) => ({ ...all_, [`${page.page}:${method}`]: event.target.value }))}
                                aria-label={copy.page(page.page)}
                                lang={DEVANAGARI.test(text) ? "ne" : "en"}
                                dir="auto"
                                rows={Math.min(24, Math.max(4, text.split("\n").length + 1))}
                                className="block w-full resize-y rounded-b-2xl bg-transparent px-3 py-3 font-[inherit] text-sm leading-relaxed text-primary outline-focus-ring focus-visible:outline-2 focus-visible:-outline-offset-2"
                            />
                        </li>
                    );
                })}
            </ol>
            <div className="flex flex-col items-center gap-3 py-2 text-center">
                <Button
                    size="lg"
                    color="primary"
                    iconLeading={FilePenLine}
                    onPress={() => {
                        openInTextEditor(texts.join("\n\n"));
                        navigate(ROUTES.textEditor);
                    }}
                >
                    {copy.openEditor}
                </Button>
                <p className="text-xs text-tertiary">
                    {copy.editorHint}{" "}
                    <Link to={ROUTES.ocr} className="font-medium text-[var(--brand)] underline-offset-4 hover:underline">
                        {t.nav.toolItems.ocr.title}
                    </Link>
                </p>
                <Button size="lg" color="tertiary" iconLeading={RotateCcw} onPress={onStartOver}>
                    {t.documents.result.startOver}
                </Button>
            </div>
        </div>
    );
}
