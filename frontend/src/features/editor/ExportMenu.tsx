import { Download, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { cn } from "@/lib/utils/cn";
import { downloadFile } from "@/lib/utils/download";
import { outputSize } from "./geometry";
import { type EditState, EXTENSIONS, type ExportFormat, renderEdit } from "./render";
import { useT } from "@/i18n";

interface ExportMenuProps {
    source: ImageBitmap | null;
    edit: EditState;
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
    const size = edit.resize ?? outputSize(edit.crop);

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
        if (!source) return;
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
            <Button
                size="md"
                color="primary"
                iconLeading={Download}
                onPress={() => setOpen((value) => !value)}
                aria-expanded={open}
                aria-haspopup="dialog"
                className="press-scale rounded-full px-4 before:rounded-full"
                isDisabled={!source}
            >
                {t.editor.export}
            </Button>

            <div
                role="dialog"
                aria-label={t.editor.exportMenu.title}
                className={cn(
                    "material absolute top-full right-0 z-30 mt-2 w-72 origin-top-right rounded-2xl p-4 transition-[opacity,scale,filter] duration-300 ease-[var(--ease-spring)]",
                    open ? "scale-100 opacity-100 blur-none" : "pointer-events-none scale-90 opacity-0 blur-[2px]",
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
                            className="mt-2 w-full accent-[var(--color-fg-primary)]"
                        />
                    </label>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-secondary pt-4">
                    <span className="text-sm text-tertiary tabular-nums">
                        {size.width.toLocaleString("en-US")} × {size.height.toLocaleString("en-US")}
                    </span>
                    <Button size="sm" color="primary" onPress={save} isDisabled={busy} className="press-scale rounded-full px-4 before:rounded-full">
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
