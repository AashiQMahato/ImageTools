import { Eye, LoaderCircle, Redo2, RotateCcw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { DropZone } from "@/features/image-processing/DropZone";
import { baseName } from "@/features/image-processing/format";
import { useImageUpload } from "@/hooks/useImageUpload";
import { cn } from "@/lib/utils/cn";
import { useImageStore } from "@/store/useImageStore";
import { AdjustPanel } from "./AdjustPanel";
import { CropControls } from "./CropControls";
import { CropStage } from "./CropStage";
import { ExportMenu } from "./ExportMenu";
import { FiltersPanel } from "./FiltersPanel";
import { aspectRatio } from "./operations";
import { decodeSource, type EditState, formatFromMime, makePreviewBase, paintPreview } from "./render";
import { ResizePanel } from "./ResizePanel";
import { isUnedited, useEditStore } from "./useEditStore";
import { useT } from "@/i18n";

export type EditorTab = "adjust" | "filters" | "crop" | "resize";

const TABS: ReadonlyArray<{ id: EditorTab }> = [
    { id: "adjust" },
    { id: "filters" },
    { id: "crop" },
    { id: "resize" },
];

interface PhotoEditorProps {
    /** "crop" is the focused crop tool; "edit" is the full editor with tabs. */
    mode: "crop" | "edit";
}

interface Decoded {
    id: string;
    bitmap: ImageBitmap;
    preview: ImageData;
    thumbnail: ImageData;
}

const pill = "press-scale rounded-full before:rounded-full";
const STAGE_HEIGHT = "h-[min(52svh,560px)] min-h-[18rem] sm:h-[min(64svh,720px)] sm:min-h-[22rem]";

/**
 * A dark studio surface, like Photos' edit mode: photo in the middle, the tools for the current task beside it,
 * undo/redo and export always within reach. Everything runs in the browser — nothing is uploaded.
 */
export function PhotoEditor({ mode }: PhotoEditorProps) {
    const t = useT();
    const original = useImageStore((state) => state.original);
    const clearImage = useImageStore((state) => state.clear);
    const upload = useImageUpload({ navigateTo: null });
    const [decoded, setDecoded] = useState<Decoded | null>(null);
    const [decodeError, setDecodeError] = useState<string | null>(null);
    const [tab, setTab] = useState<EditorTab>(mode === "crop" ? "crop" : "adjust");
    const [comparing, setComparing] = useState(false);
    const [straightening, setStraightening] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const session = useEditStore((state) => state.session);
    const { open, preview, commit, undo, redo, reset } = useEditStore.getState();
    const edit = session && decoded && session.imageId === decoded.id ? session.present : null;

    // Decode the chosen image once (EXIF-aware) and prepare preview and thumbnail copies.
    useEffect(() => {
        if (!original) return;
        let cancelled = false;
        decodeSource(original.file)
            .then((bitmap) => {
                if (cancelled) return bitmap.close();
                setDecodeError(null);
                const preview = makePreviewBase(bitmap, 1600);
                const thumbnail = makePreviewBase(bitmap, 160);
                open(original.id, bitmap.width, bitmap.height);
                setDecoded((current) => {
                    current?.bitmap.close();
                    return { id: original.id, bitmap, preview, thumbnail };
                });
            })
            .catch(() => !cancelled && setDecodeError("failed"));
        return () => {
            cancelled = true;
        };
    }, [original, open]);

    // Paint the preview whenever the look changes (or while comparing with the original).
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !decoded || !edit) return;
        const frame = requestAnimationFrame(() =>
            paintPreview(canvas, decoded.preview, comparing ? "original" : edit.filter, comparing ? { exposure: 0, brightness: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0 } : edit.adjustments),
        );
        return () => cancelAnimationFrame(frame);
    }, [decoded, edit?.filter, edit?.adjustments, comparing, edit]);

    // Keyboard: ⌘Z / ⇧⌘Z, hold M to compare.
    useEffect(() => {
        const typing = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA"].includes(target.tagName));
        const onDown = (event: KeyboardEvent) => {
            if (typing(event.target)) return;
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
            } else if (event.key.toLowerCase() === "m" && !event.repeat && mode === "edit") {
                setComparing(true);
            }
        };
        const onUp = (event: KeyboardEvent) => event.key.toLowerCase() === "m" && setComparing(false);
        window.addEventListener("keydown", onDown);
        window.addEventListener("keyup", onUp);
        return () => {
            window.removeEventListener("keydown", onDown);
            window.removeEventListener("keyup", onUp);
        };
    }, [undo, redo, mode]);

    const source = useMemo(() => (session ? session.source : { width: 1, height: 1 }), [session]);
    const lockedAspect = session && edit ? aspectRatio(session.aspect, session.portrait, edit, source) : null;
    const onPreview = useCallback((next: EditState) => preview(next), [preview]);
    const onCommit = useCallback((next: EditState) => commit(next), [commit]);

    const hasImage = Boolean(original && decoded && edit);
    const edited = edit && session ? !isUnedited(edit, session.source.width, session.source.height) : false;

    return (
        <div className="studio flex flex-col">
            {/* Top bar: history on the left, tools in the middle, compare and export on the right. */}
            <div className="studio-line flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b px-2.5 py-2 sm:px-3">
                <div className="flex items-center">
                    <Button size="sm" color="tertiary" iconLeading={Undo2} aria-label={t.editor.undo} onPress={undo} isDisabled={!session?.past.length} className={pill} />
                    <Button size="sm" color="tertiary" iconLeading={Redo2} aria-label={t.editor.redo} onPress={redo} isDisabled={!session?.future.length} className={pill} />
                    <Button size="sm" color="tertiary" iconLeading={RotateCcw} onPress={reset} isDisabled={!edited} aria-label={t.editor.revertAria} className={pill}>
                        <span className="hidden sm:inline">{t.editor.revert}</span>
                    </Button>
                </div>

                {mode === "edit" && (
                    <div className="order-last flex w-full justify-center md:order-none md:w-auto md:flex-1">
                        <Segmented kind="tab" label={t.editor.editTools} value={tab} onChange={setTab} options={TABS.map((item) => ({ value: item.id, label: t.editor.tabs[item.id] }))} />
                    </div>
                )}

                <div className="ml-auto flex items-center gap-1.5">
                    {mode === "edit" && hasImage && (
                        <Button
                            size="sm"
                            color="tertiary"
                            iconLeading={Eye}
                            onPressStart={() => setComparing(true)}
                            onPressEnd={() => setComparing(false)}
                            aria-label={t.editor.compareAria}
                            className={pill}
                        >
                            <span className="hidden lg:inline">{t.editor.compare}</span>
                        </Button>
                    )}
                    {hasImage && edit && original && (
                        <ExportMenu
                            source={decoded?.bitmap ?? null}
                            edit={edit}
                            defaultFormat={formatFromMime(original.mimeType)}
                            baseName={baseName(original.name)}
                            suffix={mode === "crop" ? "cropped" : "edited"}
                        />
                    )}
                </div>
            </div>

            {!original || decodeError ? (
                <div className="studio-stage flex h-[min(64svh,720px)] min-h-[24rem] flex-col items-center justify-center p-4 sm:p-8">
                    <DropZone onChoose={upload.openPicker} />
                    {(decodeError || upload.error) && <p className="mt-4 text-sm text-error-primary">{decodeError ? t.editor.openFailed : upload.error}</p>}
                </div>
            ) : (
                <div className={cn("grid", mode === "edit" && tab !== "crop" && "lg:grid-cols-[minmax(0,1fr)_20rem]")}>
                    <div className="relative flex min-w-0 flex-col">
                        {edit && decoded ? (
                            <CropStage
                                source={source}
                                edit={edit}
                                interactive={tab === "crop"}
                                aspect={lockedAspect}
                                straightening={straightening}
                                onPreview={onPreview}
                                onCommit={onCommit}
                                className={cn("studio-stage", STAGE_HEIGHT)}
                                image={<canvas ref={canvasRef} className="block size-full" aria-label={t.editor.editingAlt(original.name)} role="img" />}
                            />
                        ) : (
                            <div className={cn("studio-stage flex items-center justify-center text-sm text-tertiary", STAGE_HEIGHT)}>
                                <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden /> {t.editor.opening}
                            </div>
                        )}

                        {/* Holding Compare: say so on the photo itself. */}
                        <span
                            role="status"
                            className={cn(
                                "material pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-primary transition-[opacity,scale] duration-300 ease-[var(--ease-spring)]",
                                comparing ? "scale-100 opacity-100" : "scale-90 opacity-0",
                            )}
                        >
                            {comparing ? t.editor.showingOriginal : ""}
                        </span>

                        {tab === "crop" && edit && (
                            <div className="studio-line border-t px-4 pt-4 pb-5 sm:px-6">
                                <CropControls edit={edit} source={source} onPreview={onPreview} onCommit={onCommit} onStraighteningChange={setStraightening} />
                            </div>
                        )}
                    </div>

                    {mode === "edit" && tab !== "crop" && edit && (
                        <aside
                            aria-label={t.editor.tabs[tab as keyof typeof t.editor.tabs]}
                            className="studio-line border-t p-5 sm:p-6 lg:max-h-[min(64svh,720px)] lg:overflow-y-auto lg:border-t-0 lg:border-l"
                        >
                            <div key={tab} className="animate-enter [--i:-1]">
                                {tab === "adjust" && (
                                    <AdjustPanel
                                        adjustments={edit.adjustments}
                                        onChange={(adjustments) => onPreview({ ...edit, adjustments })}
                                        onCommit={(adjustments) => onCommit({ ...edit, adjustments })}
                                    />
                                )}
                                {tab === "filters" && <FiltersPanel thumbnail={decoded?.thumbnail ?? null} value={edit.filter} onSelect={(filter) => onCommit({ ...edit, filter })} />}
                                {tab === "resize" && (
                                    // Re-key on size so the text fields reset when the crop or resize changes elsewhere.
                                    <ResizePanel key={`${Math.round(edit.crop.w)}x${Math.round(edit.crop.h)}:${edit.resize?.width ?? 0}x${edit.resize?.height ?? 0}`} edit={edit} onCommit={onCommit} />
                                )}
                            </div>
                        </aside>
                    )}
                </div>
            )}

            {/* Status bar */}
            <div className="studio-line flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2.5 text-sm sm:px-5">
                {hasImage && original && edit ? (
                    <div className="flex min-w-0 items-center gap-2.5">
                        <img src={original.previewUrl} alt="" className="size-6 shrink-0 rounded object-cover ring-1 ring-black/5 dark:ring-white/10" />
                        <p className="min-w-0 truncate text-tertiary">
                            <span className="font-medium text-secondary">{original.name}</span>
                            <span className="mx-1.5 text-quaternary">·</span>
                            <span className="tabular-nums">
                                {Math.round(edit.crop.w).toLocaleString("en-US")} × {Math.round(edit.crop.h).toLocaleString("en-US")}
                            </span>
                        </p>
                    </div>
                ) : (
                    <p className="text-tertiary">{t.editor.localNote}</p>
                )}
                {original && (
                    <div className="flex shrink-0 items-center gap-4">
                        <button type="button" onClick={clearImage} className="rounded text-sm font-medium text-tertiary transition-colors hover:text-primary outline-focus-ring focus-visible:outline-2">
                            {t.common.closeImage}
                        </button>
                        <button type="button" onClick={upload.openPicker} className="link-accent text-sm font-medium">
                            {t.common.openAnother}
                        </button>
                    </div>
                )}
            </div>
            <input {...upload.inputProps} aria-hidden />
        </div>
    );
}
