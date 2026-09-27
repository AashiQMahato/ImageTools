import { Check, CircleAlert, LoaderCircle, Plus, RefreshCw, X } from "lucide-react";
import { useStudio } from "@/components/studio/StudioShell";
import { formatBytes, formatDimensions } from "@/features/image-processing/format";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import type { QueueItem } from "./useCompressionQueue";

const FORMAT_NAMES: Record<string, string> = { "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP" };

/** The images being compressed, one compact row each: what it is, and where it's up to. */
export function ImageList({ items, selectedId, currentKey, onSelect, onRemove, disabled }: { items: QueueItem[]; selectedId: string | null; currentKey: string; onSelect: (id: string) => void; onRemove: (id: string) => void; disabled?: boolean }) {
    const t = useT();
    const { openPicker } = useStudio();
    const copy = t.compress;
    return (
        <section>
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">
                    {copy.imagesTitle} <span className="font-normal text-tertiary tabular-nums">({items.length})</span>
                </h3>
                <button type="button" onClick={openPicker} disabled={disabled} className="flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2 text-xs font-semibold text-[var(--brand)] outline-focus-ring hover:bg-secondary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:h-10">
                    <Plus className="size-3.5" aria-hidden />
                    {copy.addMore}
                </button>
            </div>
            <ul className="mt-2 flex flex-col gap-1" aria-live="polite">
                {items.map((item) => {
                    const stale = item.status === "done" && item.result?.settingsKey !== currentKey;
                    const selected = item.id === selectedId;
                    return (
                        <li key={item.id}>
                            <div className={cn("group flex items-center gap-2.5 rounded-xl border p-1.5 pr-1 transition-colors duration-150", selected ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-transparent hover:bg-secondary")}>
                                <button type="button" onClick={() => onSelect(item.id)} aria-current={selected || undefined} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg text-left outline-focus-ring focus-visible:outline-2">
                                    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary">
                                        {item.thumbUrl && <img src={item.thumbUrl} alt="" className="size-full object-cover" draggable={false} />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-primary" title={item.name}>
                                            {item.name}
                                        </span>
                                        <span className="block truncate text-xs text-tertiary tabular-nums">
                                            {formatDimensions(item.dimensions)} · {formatBytes(item.size)} · {FORMAT_NAMES[item.mimeType] ?? item.mimeType.replace("image/", "").toUpperCase()}
                                        </span>
                                    </span>
                                    <Status item={item} stale={stale} />
                                </button>
                                <button type="button" onClick={() => onRemove(item.id)} aria-label={copy.remove(item.name)} title={copy.remove(item.name)} className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-quaternary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 pointer-coarse:size-10">
                                    <X className="size-3.5" aria-hidden />
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/** Words and an icon, never colour alone. */
function Status({ item, stale }: { item: QueueItem; stale: boolean }) {
    const t = useT();
    const copy = t.compress.status;
    const base = "flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums";
    if (item.status === "processing") {
        return (
            <span className={cn(base, "text-[var(--brand)]")}>
                <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                <span className="sr-only sm:not-sr-only">{copy.processing}</span>
            </span>
        );
    }
    if (item.status === "error") {
        return (
            <span className={cn(base, "text-error-primary")}>
                <CircleAlert className="size-3.5" aria-hidden />
                {copy.error}
            </span>
        );
    }
    if (item.status === "done" && item.result) {
        return (
            <span className={cn(base, stale ? "text-tertiary" : "text-success-primary")} title={stale ? copy.stale : copy.done}>
                {stale ? <RefreshCw className="size-3.5" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
                {formatBytes(item.result.size)}
                <span className="sr-only">{stale ? copy.stale : copy.done}</span>
            </span>
        );
    }
    return <span className={cn(base, "text-quaternary")}>{copy.waiting}</span>;
}
