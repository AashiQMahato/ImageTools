import { FilePlus2 } from "lucide-react";
import { useState } from "react";
import { BottomSheet } from "@/components/studio/BottomSheet";
import { useStudio } from "@/components/studio/StudioShell";
import { PanelBody, PanelIntro, StudioCanvas, StudioDropzone, StudioNotice } from "@/components/studio/StudioParts";
import { Button } from "@/components/ui/base/buttons/button";
import { ContinueWith } from "@/features/documents/ContinueWith";
import { DocumentStudio } from "@/features/documents/DocumentStudio";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { PdfViewer } from "@/features/pdf-canvas/PdfViewer";
import { formatBytes } from "@/features/image-processing/format";
import { useT } from "@/i18n";

/** Read a PDF in the browser — nothing is uploaded. */
export function ViewerPage() {
    const t = useT();
    const copy = t.documents.viewer;
    const pdf = useSinglePdf();
    const [sheet, setSheet] = useState(false);
    const details = (
        <PanelBody>
            {pdf.file ? (
                <>
                    <PdfFileSummary name={pdf.file.name} pages={pdf.ready?.sizes.length ?? null} />
                    <p className="-mt-2 text-xs text-tertiary tabular-nums">{formatBytes(pdf.file.size)}</p>
                    <OpenAnother label={copy.openAnother} />
                    {pdf.ready && <ContinueWith kind="pdf" current="pdfViewer" files={async () => [pdf.file!]} />}
                    {/* Keyboard shortcuts: only where there's likely a keyboard. */}
                    <section className="hidden flex-col gap-2 pointer-fine:flex">
                        <h3 className="text-sm font-semibold text-primary">{copy.shortcutsTitle}</h3>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                            {copy.shortcuts.map(([keys, action]) => (
                                <div key={keys} className="contents">
                                    <dt>
                                        <kbd className="rounded border border-[var(--card-line)] bg-secondary px-1.5 py-0.5 font-sans text-[0.6875rem] text-secondary">{keys}</kbd>
                                    </dt>
                                    <dd className="text-tertiary">{action}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                </>
            ) : (
                <PanelIntro title={t.studio.howItWorks} steps={copy.steps} />
            )}
            <p className="text-xs leading-relaxed text-tertiary">{copy.local}</p>
        </PanelBody>
    );

    return (
        <DocumentStudio
            tool="pdfViewer"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            panelLabel={t.nav.toolItems.pdfViewer.title}
            panel={details}
            mobilePanel={pdf.file ? "none" : "stack"}
        >
            {pdf.file ? (
                <SinglePdfWorkspace pdf={pdf}>{({ document, sizes }) => <PdfViewer key={pdf.id} file={pdf.file!} document={document} sizes={sizes} onDetails={() => setSheet(true)} />}</SinglePdfWorkspace>
            ) : (
                <StudioCanvas>
                    <StudioDropzone title={t.documents.dropPdf} hint={copy.hint} limits={t.documents.pdfLimits(MAX_PDF_MB)} />
                </StudioCanvas>
            )}
            {pdf.problem && <StudioNotice notice={{ tone: "error", text: pdf.problem }} />}
            <BottomSheet open={sheet} onClose={() => setSheet(false)} title={copy.details} closeLabel={t.documents.done}>
                {details}
            </BottomSheet>
        </DocumentStudio>
    );
}

function OpenAnother({ label }: { label: string }) {
    const { openPicker } = useStudio();
    return (
        <Button size="md" color="secondary" iconLeading={FilePlus2} onPress={openPicker} className="self-start">
            {label}
        </Button>
    );
}
