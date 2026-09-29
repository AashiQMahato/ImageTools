import { LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { useMemo, useState } from "react";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PasswordField } from "@/features/documents/PasswordField";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { useT } from "@/i18n";

export function UnlockPage() {
    const t = useT();
    const copy = t.documents.unlock;
    const job = useDocumentJob();
    const pdf = useSinglePdf({ allowLocked: true });
    const [password, setPassword] = useState("");
    const count = pdf.ready?.sizes.length ?? 0;
    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);

    const unlock = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("password", password);
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/unlock", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
        setPassword("");
    };

    return (
        <DocumentToolLayout
            tool="pdfUnlock"
            accept={PDF_ACCEPT}
            onFiles={(files) => {
                setPassword("");
                pdf.receive(files);
            }}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            doneTitle={copy.done}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <PasswordField label={copy.password} value={password} onChange={setPassword} autoComplete="off" autoFocus={pdf.locked} hint={pdf.locked ? copy.needsPassword : copy.restrictionsOnly} />
                    </section>
                    <p className="rounded-xl border border-[var(--card-line)] bg-secondary px-3 py-2.5 text-xs leading-relaxed text-secondary">{copy.ownership}</p>
                </>
            }
            action={{ label: copy.action, icon: LockKeyholeOpen, onPress: unlock, disabled: !(pdf.ready || pdf.locked) || (pdf.locked && !password) }}
        >
            {pdf.locked ? (
                <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 text-center">
                    <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-tertiary">
                        <LockKeyhole className="size-6" aria-hidden />
                    </span>
                    <p className="max-w-sm text-sm text-secondary">{copy.lockedPreview}</p>
                </div>
            ) : (
                <SinglePdfWorkspace pdf={pdf}>{({ document, sizes }) => <PageGrid document={document} sizes={sizes} items={items} label={copy.gridLabel} />}</SinglePdfWorkspace>
            )}
        </DocumentToolLayout>
    );
}
