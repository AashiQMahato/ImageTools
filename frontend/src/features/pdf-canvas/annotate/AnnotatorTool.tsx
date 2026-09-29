import { Info, Save, Signature } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/base/buttons/button";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { useT } from "@/i18n";
import { usePageScroller } from "../usePageScroller";
import { useZoom } from "../useZoom";
import { MobileBar, PageNav, PanelButton, ZoomControl } from "../ViewerControls";
import { AnnotatorPages, AnnotatorPanel, type AnnotatorMode, AnnotatorToolbar } from "./PdfAnnotator";
import { useAnnotatorKeys } from "./useAnnotatorKeys";
import { type SignatureImage, SignatureDialog } from "./SignatureDialog";
import { useAnnotator } from "./useAnnotator";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Edit PDF and Sign PDF: the same editor — signing shows only what signing needs. A new file starts afresh. */
export function AnnotatorTool({ mode }: { mode: AnnotatorMode }) {
    const pdf = useSinglePdf();
    return <Session key={pdf.id ?? "none"} mode={mode} pdf={pdf} />;
}

function Session({ mode, pdf }: { mode: AnnotatorMode; pdf: ReturnType<typeof useSinglePdf> }) {
    const t = useT();
    const copy = mode === "sign" ? t.documents.sign : t.documents.editor;
    const editorCopy = t.documents.editor;
    const job = useDocumentJob();
    const sizes = pdf.ready?.sizes ?? [];
    const annotator = useAnnotator(Math.max(1, sizes.length));
    const [area, setArea] = useState<HTMLDivElement | null>(null);
    const scroller = usePageScroller(area, sizes.length);
    const zoom = useZoom(area, sizes, 0, scroller.current);
    const { restore } = scroller;
    useLayoutEffect(() => restore(), [restore, zoom.scale]);
    const picker = useRef<HTMLInputElement>(null);
    const [signing, setSigning] = useState(false);
    const [signature, setSignature] = useState<{ key: string; width: number; height: number } | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const [sheet, setSheet] = useState(false);

    /** A picture placed in the middle of the page being looked at, at a sensible size, and selected. */
    const place = (key: string, width: number, height: number, target: number, isSignature: boolean) => {
        const page = sizes[scroller.current - 1];
        if (!page) return;
        const scale = Math.min(target / width, (page.width * 0.8) / width, (page.height * 0.5) / height);
        const w = width * scale;
        const h = height * scale;
        annotator.add({ page: scroller.current, kind: "image", x: (page.width - w) / 2, y: (page.height - h) / 2, width: w, height: h, rotation: 0, image: key, opacity: 1, ...(isSignature ? { signature: true } : {}) });
        annotator.setTool("select");
    };

    const addImage = async (file: File | undefined) => {
        if (!file) return;
        if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return setProblem(editorCopy.imageProblem);
        try {
            const bitmap = await createImageBitmap(file);
            const key = annotator.addPicture({ blob: file, width: bitmap.width, height: bitmap.height });
            // Pixels to points at 96 dpi, no wider than 40% of the page.
            place(key, bitmap.width, bitmap.height, Math.min(bitmap.width * 0.75, (sizes[scroller.current - 1]?.width ?? 600) * 0.4), false);
            bitmap.close();
            setProblem(null);
        } catch {
            setProblem(editorCopy.imageProblem);
        }
    };

    const addSignature = (image: SignatureImage) => {
        setSigning(false);
        const key = annotator.addPicture(image);
        setSignature({ key, width: image.width, height: image.height });
        place(key, image.width, image.height, 170, true);
    };
    const openSignature = () => (signature && mode === "sign" ? place(signature.key, signature.width, signature.height, 170, true) : setSigning(true));

    useAnnotatorKeys(annotator, mode, { onSignature: openSignature, zoomIn: zoom.zoomIn, zoomOut: zoom.zoomOut });

    const save = () => {
        if (!pdf.file) return;
        const { annotations, deletePages, images } = annotator.payload();
        const form = new FormData();
        form.append("annotations", JSON.stringify(annotations));
        form.append("deletePages", JSON.stringify(deletePages));
        form.append("purpose", mode);
        form.append("files", pdf.file, pdf.file.name);
        for (const image of images) form.append("images", image.blob, `${image.key}.${image.blob.type === "image/jpeg" ? "jpg" : image.blob.type === "image/webp" ? "webp" : "png"}`);
        void job.run("/pdf/annotate", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
    };

    const count = sizes.length;
    return (
        <DocumentToolLayout
            tool={mode === "sign" ? "pdfSign" : "pdfEditor"}
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={editorCopy.running}
            doneTitle={copy.done}
            onStartOver={startOver}
            sheet={{ open: sheet, onClose: () => setSheet(false), title: editorCopy.properties }}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : problem ? { tone: "error", text: problem } : null}
            toolbar={
                pdf.ready && (
                    <AnnotatorToolbar
                        annotator={annotator}
                        mode={mode}
                        zoom={zoom}
                        current={scroller.current}
                        count={count}
                        onGo={(page) => scroller.goTo(page)}
                        onImage={() => picker.current?.click()}
                        onSignature={openSignature}
                    />
                )
            }
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <AnnotatorPanel annotator={annotator} mode={mode}>
                        {mode === "sign" && (
                            <section className="flex flex-col gap-3">
                                <h3 className="text-sm font-semibold text-primary">{t.documents.sign.yourSignature}</h3>
                                {signature ? (
                                    <>
                                        <img src={annotator.pictures.get(signature.key)?.url} alt={t.documents.sign.yourSignature} className="max-h-20 self-start rounded-lg border border-[var(--card-line)] bg-white p-2" />
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" color="secondary" onPress={openSignature}>
                                                {t.documents.sign.placeAgain}
                                            </Button>
                                            <Button size="sm" color="tertiary" onPress={() => setSigning(true)}>
                                                {t.documents.sign.createNew}
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <Button size="md" color="secondary" iconLeading={Signature} onPress={() => setSigning(true)} className="self-start">
                                        {t.documents.sign.create}
                                    </Button>
                                )}
                                <p className="flex gap-2 rounded-xl border border-[var(--card-line)] bg-secondary px-3 py-2.5 text-xs leading-relaxed text-secondary">
                                    <Info className="mt-0.5 size-3.5 shrink-0 text-tertiary" aria-hidden />
                                    {t.documents.sign.disclaimer}
                                </p>
                            </section>
                        )}
                    </AnnotatorPanel>
                </>
            }
            action={{ label: editorCopy.save, icon: Save, onPress: save, disabled: !pdf.ready || !annotator.changed }}
        >
            <input ref={picker} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(event) => void addImage(event.target.files?.[0]).finally(() => (event.target.value = ""))} />
            <SinglePdfWorkspace pdf={pdf}>
                {({ document }) => (
                    <div className="flex h-full flex-col gap-2">
                        <AnnotatorPages annotator={annotator} document={document} sizes={sizes} scale={zoom.scale} area={setArea} register={scroller.register} removable={mode === "edit"} />
                        <MobileBar label={t.documents.viewer.pagesBar}>
                            <PageNav current={scroller.current} count={count} onGo={(page) => scroller.goTo(page)} />
                            <ZoomControl zoom={zoom} compact />
                            <PanelButton label={editorCopy.properties} onClick={() => setSheet(true)} badge={Boolean(annotator.selected)} />
                        </MobileBar>
                    </div>
                )}
            </SinglePdfWorkspace>
            <SignatureDialog open={signing} onClose={() => setSigning(false)} onCreate={addSignature} />
        </DocumentToolLayout>
    );
}
