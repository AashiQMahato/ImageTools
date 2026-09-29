import type { PDFDocumentProxy } from "pdfjs-dist";
import { Check, GripVertical } from "lucide-react";
import { type MouseEvent, type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { PageThumbnail } from "./PageThumbnail";
import { useSortable } from "./useSortable";

/** A page as the tools see it: a stable key, the source page (1-based), and a turn on top of it. */
export interface PageItem {
    key: string;
    page: number;
    rotate: 0 | 90 | 180 | 270;
}

interface PageGridProps {
    document: PDFDocumentProxy;
    sizes: { width: number; height: number }[];
    items: readonly PageItem[];
    /** Selected keys (null: pages can't be selected here). */
    selected?: ReadonlySet<string> | null;
    onSelectedChange?: (selected: Set<string>) => void;
    /** Reorder by dragging (and Alt+arrows). */
    onReorder?: (items: PageItem[]) => void;
    /** Buttons on each card (shown on hover or focus, always on touch). */
    actions?: (item: PageItem, index: number) => ReactNode;
    /** A small label in the corner (e.g. which output file the page goes to). */
    badge?: (item: PageItem, index: number) => ReactNode;
    /** Dim pages that won't be in the result. */
    dimmed?: (item: PageItem) => boolean;
    label: string;
}

/**
 * Every page as a thumbnail, drawn as it scrolls into view. Click (or Space) selects, Shift-click
 * selects a run, and with `onReorder` pages can be dragged into a new order.
 */
export function PageGrid({ document, sizes, items, selected = null, onSelectedChange, onReorder, actions, badge, dimmed, label }: PageGridProps) {
    const t = useT();
    const copy = t.documents.pages;
    const anchor = useRef<string | null>(null);
    const { attachContainer, attachGhost, drag, itemProps } = useSortable({ items, getId: (item) => item.key, onReorder: onReorder ?? (() => undefined), disabled: !onReorder });

    const toggle = (item: PageItem, event: MouseEvent | { shiftKey: boolean }) => {
        if (!selected || !onSelectedChange) return;
        const next = new Set(selected);
        if (event.shiftKey && anchor.current) {
            // A run from the last page clicked to this one.
            const from = items.findIndex((candidate) => candidate.key === anchor.current);
            const to = items.findIndex((candidate) => candidate.key === item.key);
            for (let index = Math.min(from, to); index <= Math.max(from, to); index++) next.add(items[index]!.key);
        } else if (next.has(item.key)) next.delete(item.key);
        else next.add(item.key);
        anchor.current = item.key;
        onSelectedChange(next);
    };

    const dragged = drag ? items.find((item) => item.key === drag!.id) : null;

    return (
        <>
            <ul
                ref={attachContainer}
                aria-label={label}
                aria-multiselectable={selected ? true : undefined}
                className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] sm:gap-4"
            >
                {items.map((item, index) => {
                    const isSelected = selected?.has(item.key) ?? false;
                    const size = sizes[item.page - 1] ?? { width: 612, height: 792 };
                    return (
                        <li
                            key={item.key}
                            {...itemProps(item.key)}
                            tabIndex={0}
                            role={selected ? "checkbox" : undefined}
                            aria-checked={selected ? isSelected : undefined}
                            aria-label={copy.pageLabel(item.page, item.rotate)}
                            onClick={(event) => toggle(item, event)}
                            onKeyDown={(event) => {
                                itemProps(item.key).onKeyDown(event);
                                if (event.defaultPrevented) return;
                                if ((event.key === " " || event.key === "Enter") && event.target === event.currentTarget) {
                                    event.preventDefault();
                                    toggle(item, event);
                                }
                            }}
                            className={cn(
                                "group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-2 outline-focus-ring transition-[border-color,background-color,opacity] duration-150 select-none focus-visible:outline-2 data-dragging:opacity-30",
                                isSelected ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-transparent hover:bg-secondary",
                                onReorder && "touch-pan-y",
                                dimmed?.(item) && "opacity-40",
                            )}
                        >
                            <PageFrame size={size} rotate={item.rotate}>
                                <PageThumbnail document={document} page={item.page} rotate={item.rotate} size={size} width={160} label="" />
                            </PageFrame>
                            <span className="flex items-center justify-center gap-1 text-xs text-secondary tabular-nums">
                                {onReorder && (
                                    <span data-drag-handle className="-my-1 grid size-7 cursor-grab touch-none place-items-center rounded-md text-quaternary pointer-fine:hidden" aria-hidden>
                                        <GripVertical className="size-4" />
                                    </span>
                                )}
                                {item.page}
                            </span>
                            {selected && (
                                <span aria-hidden className={cn("absolute top-3 left-3 grid size-5 place-items-center rounded-md border shadow-sm transition-opacity duration-150", isSelected ? "border-[var(--brand)] bg-[var(--brand)] text-white opacity-100" : "border-[var(--card-line)] bg-primary opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100")}>
                                    {isSelected && <Check className="size-3.5" strokeWidth={3} />}
                                </span>
                            )}
                            {badge && <span className="absolute top-3 right-3">{badge(item, index)}</span>}
                            {actions && (
                                <span data-no-drag className="absolute right-2 bottom-8 flex gap-1 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                                    {actions(item, index)}
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
            {dragged && drag && (
                <div ref={attachGhost} aria-hidden className="pointer-events-none fixed top-0 left-0 z-50 rounded-xl border border-[var(--brand)] bg-primary p-2 shadow-2xl" style={{ width: drag.size.width }}>
                    <PageFrame size={sizes[dragged.page - 1] ?? { width: 612, height: 792 }} rotate={dragged.rotate}>
                        <PageThumbnail document={document} page={dragged.page} rotate={dragged.rotate} size={sizes[dragged.page - 1] ?? { width: 612, height: 792 }} width={160} label="" />
                    </PageFrame>
                </div>
            )}
        </>
    );
}

const FRAME = 3 / 4;

/** Every card the same shape: the page centred in it, as wide or as tall as fits. */
function PageFrame({ size, rotate, children }: { size: { width: number; height: number }; rotate: number; children: ReactNode }) {
    const aspect = rotate % 180 ? size.height / size.width : size.width / size.height;
    return (
        <div className="grid aspect-[3/4] place-items-center">
            <div style={aspect >= FRAME ? { width: "100%" } : { height: "100%", aspectRatio: `${aspect}` }} className="grid place-items-center">
                {children}
            </div>
        </div>
    );
}

/** A small icon button for page cards. */
export function PageAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
            className="grid size-8 cursor-pointer place-items-center rounded-lg border border-[var(--card-line)] bg-primary/95 text-secondary shadow-sm outline-focus-ring backdrop-blur hover:text-primary focus-visible:outline-2 pointer-coarse:size-9"
        >
            {children}
        </button>
    );
}
