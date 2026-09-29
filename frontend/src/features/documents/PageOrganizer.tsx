import { CopyPlus, FileOutput, type LucideIcon, Redo2, RotateCcw, RotateCw, Save, SquareCheckBig, SquareDashed, Trash2, Undo2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDocHistory } from "@/features/background-removal/editor/document";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { DocumentToolLayout } from "./DocumentToolLayout";
import { MAX_PDF_MB, PDF_ACCEPT } from "./limits";
import { PageAction, PageGrid, type PageItem } from "./PageGrid";
import { PdfFileSummary, SinglePdfWorkspace } from "./SinglePdfWorkspace";
import { useDocumentJob } from "./useDocumentJob";
import { useSinglePdf } from "./useSinglePdf";

export type OrganizerMode = "organize" | "rotate";
type Turn = 90 | 180 | 270;

const turned = (item: PageItem, by: number): PageItem => ({ ...item, rotate: (((item.rotate + by) % 360) + 360) % 360 as PageItem["rotate"] });

/**
 * One PDF's pages to rearrange: reorder, rotate, duplicate, delete, or take a selection out as a new
 * PDF. "Rotate" is the same workspace with only turning on offer. Every change can be undone; nothing
 * happens to the file until it's saved.
 */
export function PageOrganizer({ mode }: { mode: OrganizerMode }) {
    const t = useT();
    const copy = mode === "rotate" ? t.documents.rotate : t.documents.organize;
    const pdf = useSinglePdf();
    const job = useDocumentJob();
    const startOver = () => {
        job.reset();
        pdf.clear();
    };

    if (pdf.file && pdf.ready) {
        return <Organizer key={pdf.id} mode={mode} pdf={pdf} job={job} onStartOver={startOver} />;
    }
    return (
        <DocumentToolLayout
            tool={mode === "rotate" ? "pdfRotate" : "pdfOrganize"}
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={!pdf.file}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={copy.running}
            onStartOver={startOver}
            notice={pdf.problem ? { tone: "error", text: pdf.problem } : null}
            action={{ label: copy.action, icon: Save, onPress: () => undefined, disabled: true }}
        >
            <SinglePdfWorkspace pdf={pdf}>{() => null}</SinglePdfWorkspace>
        </DocumentToolLayout>
    );
}

function Organizer({ mode, pdf, job, onStartOver }: { mode: OrganizerMode; pdf: ReturnType<typeof useSinglePdf>; job: ReturnType<typeof useDocumentJob>; onStartOver: () => void }) {
    const t = useT();
    const copy = t.documents.organize;
    const rotateCopy = t.documents.rotate;
    const { document, sizes } = pdf.ready!;
    const count = sizes.length;
    const initial = useMemo<PageItem[]>(() => Array.from({ length: count }, (_, index) => ({ key: `p${index + 1}`, page: index + 1, rotate: 0 })), [count]);
    const history = useDocHistory<PageItem[]>(initial);
    const items = history.doc;
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [extracting, setExtracting] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    // Selection only ever refers to pages that still exist.
    const live = useMemo(() => new Set([...selected].filter((key) => items.some((item) => item.key === key))), [selected, items]);
    const targets = (all: boolean) => (live.size && !all ? live : new Set(items.map((item) => item.key)));

    const rotate = (by: Turn, keys = targets(false)) => history.commit((doc) => doc.map((item) => (keys.has(item.key) ? turned(item, by) : item)));
    const duplicate = (keys = live) =>
        history.commit((doc) =>
            doc.flatMap((item) => (keys.has(item.key) ? [item, { ...item, key: crypto.randomUUID() }] : [item])),
        );
    const remove = (keys = live) => {
        if (!keys.size) return;
        if (keys.size >= items.length) return setNotice(copy.keepOne);
        setNotice(null);
        history.commit((doc) => doc.filter((item) => !keys.has(item.key)));
        setSelected(new Set());
    };

    const run = (plan: PageItem[], extract: boolean) => {
        if (!pdf.file || !plan.length) return;
        setExtracting(extract);
        const form = new FormData();
        form.append("plan", JSON.stringify(plan.map(({ page, rotate: turn }) => ({ page, rotate: turn }))));
        form.append("files", pdf.file, pdf.file.name);
        void job.run("/pdf/organize", form);
    };

    const changed = items.length !== initial.length || items.some((item, index) => item.page !== index + 1 || item.rotate !== 0);
    const selectedPlan = items.filter((item) => live.has(item.key));

    // Keyboard, anywhere in the tool (not while typing): Delete removes, R turns, ⌘A selects all,
    // ⌘Z / ⇧⌘Z undo and redo, Escape clears the selection.
    const keys = useRef<(event: KeyboardEvent) => void>(() => undefined);
    // The latest handler (it reads current state), swapped in after each render.
    useLayoutEffect(() => {
        keys.current = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest("input, select, textarea, [contenteditable='true'], [role='dialog']") || job.phase !== "idle" && job.phase !== "failed") return;
            const mod = event.metaKey || event.ctrlKey;
            if (mod && event.key.toLowerCase() === "z") {
                event.preventDefault();
                if (event.shiftKey) history.redo();
                else history.undo();
            } else if (mod && event.key.toLowerCase() === "a") {
                event.preventDefault();
                setSelected(new Set(items.map((item) => item.key)));
            } else if ((event.key === "Delete" || event.key === "Backspace") && mode === "organize" && live.size) {
                event.preventDefault();
                remove();
            } else if (event.key.toLowerCase() === "r" && !mod) {
                event.preventDefault();
                rotate(event.shiftKey ? 270 : 90);
            } else if (event.key === "Escape") setSelected(new Set());
        };
    });
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => keys.current(event);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const button = (icon: LucideIcon, label: string, onClick: () => void, disabled = false, short = label) => {
        const Icon = icon;
        return (
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                title={label}
                className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-secondary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-11"
            >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span aria-hidden className="hidden xl:inline">{short}</span>
                <span className="sr-only">{label}</span>
            </button>
        );
    };
    const divider = <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-[var(--card-line)]" />;
    const allSelected = live.size === items.length;

    const toolbar = (
        <div role="toolbar" aria-label={copy.toolbar} className="scrollbar-hide flex shrink-0 items-center gap-0.5 overflow-x-auto rounded-xl border border-[var(--card-line)] bg-primary px-1.5 py-1">
            {button(allSelected ? SquareDashed : SquareCheckBig, allSelected ? copy.selectNone : copy.selectAll, () => setSelected(allSelected ? new Set() : new Set(items.map((item) => item.key))))}
            {divider}
            {button(RotateCcw, live.size ? copy.rotateLeftSelected : copy.rotateLeftAll, () => rotate(270), false, copy.rotateLeft)}
            {button(RotateCw, live.size ? copy.rotateRightSelected : copy.rotateRightAll, () => rotate(90), false, copy.rotateRight)}
            {mode === "organize" && (
                <>
                    {button(CopyPlus, copy.duplicate, () => duplicate(), !live.size)}
                    {button(Trash2, copy.delete, () => remove(), !live.size)}
                    {divider}
                    {button(FileOutput, copy.extractFull, () => run(selectedPlan, true), !live.size, copy.extract)}
                </>
            )}
            <span className="ml-auto" />
            {button(Undo2, t.editor.undo, history.undo, !history.canUndo)}
            {button(Redo2, t.editor.redo, history.redo, !history.canRedo)}
        </div>
    );

    return (
        <DocumentToolLayout
            tool={mode === "rotate" ? "pdfRotate" : "pdfOrganize"}
            accept={PDF_ACCEPT}
            onFiles={pdf.receive}
            empty={false}
            drop={{ title: t.documents.dropPdf, hint: copy.hint, limits: t.documents.pdfLimits(MAX_PDF_MB) }}
            intro={copy.steps}
            job={job}
            runningTitle={extracting ? copy.extracting : mode === "rotate" ? rotateCopy.running : copy.running}
            doneTitle={extracting ? copy.extracted : undefined}
            onStartOver={onStartOver}
            notice={notice ? { tone: "error", text: notice } : null}
            toolbar={toolbar}
            options={
                <>
                    <PdfFileSummary name={pdf.file!.name} pages={count} />
                    {mode === "rotate" ? (
                        <section className="flex flex-col gap-3">
                            <h3 className="text-sm font-semibold text-primary">{rotateCopy.turnTitle}</h3>
                            <div role="group" aria-label={rotateCopy.turnTitle} className="grid grid-cols-3 gap-2">
                                {([270, 180, 90] as const).map((by) => {
                                    const Icon = by === 270 ? RotateCcw : RotateCw;
                                    return (
                                        <button
                                            key={by}
                                            type="button"
                                            onClick={() => rotate(by)}
                                            className="flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-[var(--card-line)] px-2 py-2 text-sm font-medium text-secondary outline-focus-ring transition-colors duration-150 hover:bg-primary_hover hover:text-primary focus-visible:outline-2"
                                        >
                                            <Icon className={cn("size-4", by === 180 && "rotate-90")} aria-hidden />
                                            {rotateCopy.by[by]}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-tertiary">{live.size ? rotateCopy.selectedHint(live.size) : rotateCopy.allHint}</p>
                        </section>
                    ) : (
                        <section className="flex flex-col gap-1.5">
                            <h3 className="text-sm font-semibold text-primary">{copy.pagesTitle}</h3>
                            <p className="text-sm text-secondary tabular-nums">{copy.pageCount(items.length, live.size)}</p>
                            <p className="text-xs text-tertiary">{copy.hints}</p>
                        </section>
                    )}
                    <p className="text-xs text-quaternary">{copy.shortcuts}</p>
                </>
            }
            secondary={
                changed ? (
                    <button type="button" onClick={() => history.commit(() => initial)} className="h-11 cursor-pointer rounded-lg px-4 text-sm font-semibold text-secondary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2">
                        {copy.reset}
                    </button>
                ) : undefined
            }
            action={{ label: mode === "rotate" ? rotateCopy.action : copy.action, icon: Save, onPress: () => run(items, false), disabled: !changed }}
        >
            <div className="min-h-full">
                <PageGrid
                    document={document}
                    sizes={sizes}
                    items={items}
                    selected={live}
                    onSelectedChange={setSelected}
                    onReorder={mode === "organize" ? (next) => history.commit(() => next) : undefined}
                    label={copy.gridLabel}
                    actions={(item) => (
                        <>
                            <PageAction label={copy.rotateRightPage(item.page)} onClick={() => rotate(90, new Set([item.key]))}>
                                <RotateCw className="size-4" aria-hidden />
                            </PageAction>
                            {mode === "organize" && (
                                <>
                                    <PageAction label={copy.duplicatePage(item.page)} onClick={() => duplicate(new Set([item.key]))}>
                                        <CopyPlus className="size-4" aria-hidden />
                                    </PageAction>
                                    <PageAction label={copy.deletePage(item.page)} onClick={() => remove(new Set([item.key]))}>
                                        <Trash2 className="size-4" aria-hidden />
                                    </PageAction>
                                </>
                            )}
                        </>
                    )}
                />
            </div>
        </DocumentToolLayout>
    );
}
