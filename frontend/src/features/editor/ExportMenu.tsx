import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { studioExportButton } from "@/components/studio/styles";
import { cn } from "@/lib/utils/cn";
import { downloadFile } from "@/lib/utils/download";
import { outputSize } from "./geometry";
import { type EditState, EXTENSIONS, type ExportFormat, renderEdit } from "./render";
import { useT } from "@/i18n";

interface ExportMenuProps {
    source: ImageBitmap | null;
    /** Null until an image is open; the button is then disabled. */
    edit: EditState | null;
    defaultFormat: ExportFormat;
    baseName: string;
    suffix: string;
}

const FORMATS: ReadonlyArray<{ id: ExportFormat; label: string }> = [
    { id: "jpeg", label: "JPG" },
    { id: "png", label: "PNG" },
    { id: "webp", label: "WebP" },
];

/** The export popover grows out of its button (anchored origin) and renders the full-resolution result on demand. */
export function ExportMenu({ source, edit, defaultFormat, baseName, suffix }: ExportMenuProps) {
    const t = useT();
    const [open, setOpen] = useState(false);
    const [format, setFormat] = useState<ExportFormat>(defaultFormat);
    const [quality, setQuality] = useState(92);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const root = useRef<HTMLDivElement>(null);
    const size = edit ? (edit.resize ?? outputSize(edit.crop)) : null;

    useEffect(() => {
        if (!open) return;
        const onDown = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
        window.addEventListener("pointerdown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("pointerdown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const save = async () => {
        if (!source || !edit) return;
        setBusy(true);
        setError(null);
        try {
            // Let the spinner paint before the heavy synchronous work.
            await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
            const blob = await renderEdit(source, edit, format, quality / 100);
            const url = URL.createObjectURL(blob);
            downloadFile(url, `${baseName}-${suffix}.${EXTENSIONS[format]}`);
            setTimeout(() => URL.revokeObjectURL(url), 30_000);
            setOpen(false);
        } catch (cause) {
            setError(cause instanceof Error && cause.message === "too-large" ? t.editor.exportMenu.tooLarge : t.editor.exportMenu.failed);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div ref={root} className="relative">
            <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="dialog" disabled={!source || !edit} className={studioExportButton}>
                <Download className="size-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">{t.editor.export}</span>
                <ChevronDown className={cn("size-4 opacity-70 transition-transform duration-200", open && "rotate-180")} aria-hidden />
            </button>

            <div
                role="dialog"
                aria-label={t.editor.exportMenu.title}
                className={cn(
                    "absolute top-full right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1.5rem)] origin-top-right rounded-2xl border border-[var(--card-line)] bg-primary p-4 shadow-xl transition-[opacity,scale] duration-200 ease-[var(--ease-out)]",
                    open ? "scale-100 opacity-100" : "pointer-events-none invisible scale-95 opacity-0",
                )}
            >
                <p className="text-label text-tertiary">{t.editor.exportMenu.format}</p>
                <Segmented
                    label={t.editor.exportMenu.format}
                    size="sm"
                    className="mt-2 w-full [&>button]:flex-1"
                    value={format}
                    onChange={setFormat}
                    options={FORMATS.map((option) => ({ value: option.id, label: option.label }))}
                />
                <p className="mt-2 text-xs text-tertiary">{t.editor.exportMenu.notes[format]}</p>

                {format !== "png" && (
                    <label className="mt-4 block">
                        <span className="flex justify-between text-sm text-secondary">
                            {t.editor.exportMenu.quality} <span className="tabular-nums text-tertiary">{quality}</span>
                        </span>
                        <input
                            type="range"
                            min={60}
                            max={100}
                            value={quality}
                            onChange={(event) => setQuality(Number(event.target.value))}
                            className="mt-2 w-full accent-[var(--color-bg-brand-solid)] pointer-coarse:h-8"
                        />
                    </label>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-secondary pt-4">
                    <span className="text-sm text-tertiary tabular-nums">{size && `${size.width.toLocaleString("en-US")} × ${size.height.toLocaleString("en-US")}`}</span>
                    <Button size="md" color="primary" iconLeading={busy ? undefined : Download} onPress={save} isDisabled={busy} className="press-scale pointer-coarse:min-h-11">
                        {busy ? <LoaderCircle className="size-4 animate-spin" aria-label={t.editor.exportMenu.preparing} /> : t.common.download}
                    </Button>
                </div>
                {error && (
                    <p role="alert" className="mt-3 text-sm text-error-primary">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}
