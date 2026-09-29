import { GripVertical, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { useSortable } from "./useSortable";

interface SortableCardsProps<T> {
    items: readonly T[];
    getId: (item: T) => string;
    onReorder: (items: T[]) => void;
    onRemove: (item: T) => void;
    /** The picture (a page or an image), in a fixed-ratio frame. */
    thumbnail: (item: T) => ReactNode;
    name: (item: T) => string;
    meta: (item: T) => ReactNode;
    /** Extra buttons (e.g. rotate). */
    actions?: (item: T) => ReactNode;
    /** Something's wrong with this one (it's outlined and says so). */
    problem?: (item: T) => string | null;
    label: string;
}

/**
 * Files as cards in the order they'll be used, numbered. Drag (or Alt+arrows) to reorder; remove
 * with the ✕. Used for PDFs to merge and images to combine.
 */
export function SortableCards<T>({ items, getId, onReorder, onRemove, thumbnail, name, meta, actions, problem, label }: SortableCardsProps<T>) {
    const t = useT();
    const { attachContainer, attachGhost, drag, itemProps } = useSortable({ items, getId, onReorder });
    const dragged = drag ? items.find((item) => getId(item) === drag!.id) : undefined;

    const card = (item: T, index: number, ghost = false) => {
        const issue = problem?.(item) ?? null;
        return (
            <>
                <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-secondary">
                    {thumbnail(item)}
                    <span className="absolute top-2 left-2 grid min-w-6 place-items-center rounded-md bg-neutral-950/65 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums backdrop-blur">{index + 1}</span>
                </div>
                <div className="flex min-w-0 items-start gap-1">
                    <span data-drag-handle className="-ml-1 grid size-7 shrink-0 cursor-grab touch-none place-items-center rounded-md text-quaternary pointer-fine:hidden" aria-hidden>
                        <GripVertical className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-primary" title={name(item)}>
                            {name(item)}
                        </span>
                        <span className={cn("block truncate text-xs tabular-nums", issue ? "text-error-primary" : "text-tertiary")}>{issue ?? meta(item)}</span>
                    </span>
                </div>
                {!ghost && (
                    <span data-no-drag className="absolute top-3 right-3 flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                        {actions?.(item)}
                        <button
                            type="button"
                            onClick={() => onRemove(item)}
                            aria-label={t.documents.remove(name(item))}
                            title={t.documents.remove(name(item))}
                            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[var(--card-line)] bg-primary/95 text-secondary shadow-sm outline-focus-ring backdrop-blur hover:text-error-primary focus-visible:outline-2 pointer-coarse:size-9"
                        >
                            <X className="size-4" aria-hidden />
                        </button>
                    </span>
                )}
            </>
        );
    };

    return (
        <>
            <p className="mb-3 text-xs text-tertiary">{t.documents.moveHint}</p>
            <ul
                ref={attachContainer}
                aria-label={label}
                className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] sm:gap-4"
            >
                {items.map((item, index) => (
                    <li
                        key={getId(item)}
                        {...itemProps(getId(item))}
                        tabIndex={0}
                        aria-label={`${index + 1}. ${name(item)}`}
                        className={cn(
                            "group relative flex cursor-grab flex-col gap-2 rounded-xl border bg-primary p-2 outline-focus-ring transition-[border-color,box-shadow,opacity] duration-150 select-none hover:shadow-sm focus-visible:outline-2 active:cursor-grabbing data-dragging:opacity-30",
                            problem?.(item) ? "border-error_subtle" : "border-[var(--card-line)]",
                        )}
                    >
                        {card(item, index)}
                    </li>
                ))}
            </ul>
            {dragged && drag && (
                <div ref={attachGhost} aria-hidden className="pointer-events-none fixed top-0 left-0 z-50 flex flex-col gap-2 rounded-xl border border-[var(--brand)] bg-primary p-2 shadow-2xl" style={{ width: drag.size.width }}>
                    {card(dragged, items.indexOf(dragged), true)}
                </div>
            )}
        </>
    );
}
