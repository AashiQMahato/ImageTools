import { Droplets, ImagePlus } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import { DocumentToolLayout } from "@/features/documents/DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "@/features/documents/limits";
import { PageGrid, type PageItem } from "@/features/documents/PageGrid";
import { PdfFileSummary, SinglePdfWorkspace } from "@/features/documents/SinglePdfWorkspace";
import { measureStamp, type Position, stampCentres } from "@/features/documents/stampLayout";
import { ColourPicker, PositionPicker, StampOverlay, StampText } from "@/features/documents/StampPreview";
import { useDocumentJob } from "@/features/documents/useDocumentJob";
import { PageScopeControl } from "@/features/documents/PageScopeControl";
import { usePageScope } from "@/features/documents/usePageScope";
import { useSinglePdf } from "@/features/documents/useSinglePdf";
import { useT } from "@/i18n";

const SPOTS = ["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"] as const;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface Mark {
    file: File;
    url: string;
    width: number;
    height: number;
}

export function WatermarkPage() {
    const t = useT();
    const copy = t.documents.watermark;
    const job = useDocumentJob();
    const pdf = useSinglePdf();
    const count = pdf.ready?.sizes.length ?? 0;
    const pages = usePageScope(count);
    const [kind, setKind] = useState<"text" | "image">("text");
    const [text, setText] = useState(copy.defaultText);
    const [fontSize, setFontSize] = useState(56);
    const [color, setColor] = useState("#c0392b");
    const [opacity, setOpacity] = useState(30);
    const [rotation, setRotation] = useState(-45);
    const [layout, setLayout] = useState<"single" | "tile">("single");
    const [position, setPosition] = useState<Position>("center");
    const [scale, setScale] = useState(40);
    const [mark, setMark] = useState<Mark | null>(null);
    const [problem, setProblem] = useState<string | null>(null);
    const picker = useRef<HTMLInputElement>(null);
    const textId = useId();

    useEffect(() => () => void (mark && URL.revokeObjectURL(mark.url)), [mark]);

    const pickImage = async (file: File | undefined) => {
        if (!file) return;
        if (!IMAGE_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) return setProblem(copy.imageProblem);
        try {
            const bitmap = await createImageBitmap(file);
            setMark({ file, url: URL.createObjectURL(file), width: bitmap.width, height: bitmap.height });
            bitmap.close();
            setProblem(null);
        } catch {
            setProblem(copy.imageProblem);
        }
    };

    const items = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: String(index + 1), page: index + 1, rotate: 0 })), [count]);
    const where: Position | "tile" = layout === "tile" ? "tile" : position;
    const textStamp = kind === "text" && text.trim() ? measureStamp(text.trim(), fontSize, true) : null;
    const ready = kind === "text" ? Boolean(text.trim()) : Boolean(mark);

    const apply = () => {
        if (!pdf.file) return;
        const form = new FormData();
        form.append("kind", kind);
        form.append("text", text.trim());
        form.append("fontSize", String(fontSize));
        form.append("color", color);
        form.append("opacity", String(opacity / 100));
        form.append("rotation", String(rotation));
        form.append("position", where);
        form.append("imageScale", String(scale / 100));
        if (pages.param) form.append("pages", pages.param);
        form.append("files", pdf.file, pdf.file.name);
        if (kind === "image" && mark) form.append("image", mark.file, mark.file.name);
        void job.run("/pdf/watermark", form);
    };
    const startOver = () => {
        job.reset();
        pdf.clear();
        pages.reset();
    };

    return (
        <DocumentToolLayout
            tool="pdfWatermark"
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem || problem ? { tone: "error", text: (pdf.problem ?? problem)! } : null}
            action={{ label: copy.action(pages.count), icon: Droplets, onPress: apply, disabled: !pdf.ready || !ready || !pages.valid || pages.count === 0 }}
            options={
                <>
                    <PdfFileSummary name={pdf.file?.name ?? ""} pages={count || null} />
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.kind}</h3>
                        <Segmented label={copy.kind} value={kind} onChange={setKind} options={(["text", "image"] as const).map((value) => ({ value, label: copy.kinds[value] }))} />
                        {kind === "text" ? (
                            <>
                                <label htmlFor={textId} className="sr-only">
                                    {copy.text}
                                </label>
                                <input
                                    id={textId}
                                    value={text}
                                    maxLength={120}
                                    onChange={(event) => setText(event.target.value)}
                                    placeholder={copy.defaultText}
                                    className="h-10 rounded-lg border border-[var(--card-line)] bg-primary px-3 text-sm text-primary outline-focus-ring placeholder:text-quaternary focus-visible:outline-2 pointer-coarse:h-11"
                                />
                                <Range label={copy.size} value={fontSize} min={12} max={160} onChange={setFontSize} format={(value) => `${value} pt`} />
                                <ColourPicker value={color} onChange={setColor} label={copy.colour} />
                            </>
                        ) : (
                            <>
                                <input ref={picker} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(event) => void pickImage(event.target.files?.[0]).finally(() => (event.target.value = ""))} />
                                <button
                                    type="button"
                                    onClick={() => picker.current?.click()}
                                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--card-line)] px-3 py-2 text-left outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                                >
                                    {mark ? <img src={mark.url} alt="" className="size-10 rounded-md bg-[var(--seg-track)] object-contain" /> : <ImagePlus className="size-5 text-tertiary" aria-hidden />}
                                    <span className="min-w-0 text-sm font-medium text-secondary">{mark ? copy.changeImage : copy.chooseImage}</span>
                                </button>
                                <Range label={copy.imageSize} value={scale} min={5} max={100} onChange={setScale} format={(value) => `${value}%`} />
                            </>
                        )}
                    </section>
                    <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-semibold text-primary">{copy.placement}</h3>
                        <Segmented label={copy.placement} value={layout} onChange={setLayout} options={(["single", "tile"] as const).map((value) => ({ value, label: copy.layouts[value] }))} />
                        {layout === "single" && <PositionPicker value={position} onChange={setPosition} spots={SPOTS} label={copy.position} names={copy.positions} />}
                        <Range label={copy.rotation} value={rotation} min={-90} max={90} onChange={setRotation} format={(value) => `${value}°`} />
                        <Range label={copy.opacity} value={opacity} min={5} max={100} onChange={setOpacity} format={(value) => `${value}%`} />
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
                            if (!pages.includes(item.page)) return null;
                            if (textStamp) {
                                return (
                                    <StampOverlay page={page} centres={stampCentres(page, textStamp, rotation, where)} size={textStamp} rotation={rotation} opacity={opacity / 100}>
                                        <StampText text={text.trim()} size={fontSize} pageWidth={page.width} font={textStamp.font} color={color} />
                                    </StampOverlay>
                                );
                            }
                            if (kind === "image" && mark) {
                                const size = { width: page.width * (scale / 100), height: (page.width * (scale / 100) * mark.height) / mark.width };
                                return (
                                    <StampOverlay page={page} centres={stampCentres(page, size, rotation, where)} size={size} rotation={rotation} opacity={opacity / 100}>
                                        <img src={mark.url} alt="" className="size-full" />
                                    </StampOverlay>
                                );
                            }
                            return null;
                        }}
                    />
                )}
            </SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}
