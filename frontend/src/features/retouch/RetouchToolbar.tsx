import { Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { type RetouchTool, TOOL_ICONS } from "./modes";

interface RetouchToolbarProps {
    tool: RetouchTool;
    onToolChange: (tool: RetouchTool) => void;
    paintable: boolean;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onOpenSettings: () => void;
    /** The primary action (Retouch, or Keep while a result waits). */
    action: ReactNode;
}

/** Phones and tablets: the tools in one row under the image, thumb-reachable, with the main action at the end. */
export function RetouchToolbar({ tool, onToolChange, paintable, canUndo, canRedo, onUndo, onRedo, onOpenSettings, action }: RetouchToolbarProps) {
    const t = useT();
    const copy = t.retouch;
    const item =
        "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.6875rem] font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-35 min-h-12";
    const labels: Record<RetouchTool, string> = { paint: copy.paint, erase: copy.erase, move: copy.move };

    return (
        <div role="toolbar" aria-label={copy.tools} className="flex items-center gap-1 rounded-2xl border border-[var(--card-line)] bg-primary p-1 lg:hidden">
            {(Object.keys(TOOL_ICONS) as RetouchTool[]).map((id) => {
                const Icon = TOOL_ICONS[id];
                const selected = tool === id;
                return (
                    <button
                        key={id}
                        type="button"
                        aria-pressed={selected}
                        disabled={!paintable && id !== "move"}
                        onClick={() => onToolChange(id)}
                        className={cn(item, selected ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-tertiary hover:text-primary")}
                    >
                        <Icon className="size-[1.125rem]" aria-hidden />
                        <span className="truncate">{labels[id]}</span>
                    </button>
                );
            })}
            <span aria-hidden className="h-8 w-px shrink-0 bg-[var(--card-line)]" />
            <button type="button" className={cn(item, "text-tertiary hover:text-primary")} onClick={onUndo} disabled={!canUndo} aria-label={copy.undo}>
                <Undo2 className="size-[1.125rem]" aria-hidden />
                <span className="truncate max-[380px]:sr-only">{copy.undo}</span>
            </button>
            <button type="button" className={cn(item, "text-tertiary hover:text-primary")} onClick={onRedo} disabled={!canRedo} aria-label={copy.redo}>
                <Redo2 className="size-[1.125rem]" aria-hidden />
                <span className="truncate max-[380px]:sr-only">{copy.redo}</span>
            </button>
            <button type="button" className={cn(item, "text-tertiary hover:text-primary")} onClick={onOpenSettings} aria-haspopup="dialog">
                <SlidersHorizontal className="size-[1.125rem]" aria-hidden />
                <span className="truncate">{copy.settings}</span>
            </button>
            <div className="shrink-0 pl-0.5">{action}</div>
        </div>
    );
}

/**
 * The settings panel as a sheet rising from the bottom (phones and tablets). Stays mounted so it can
 * slide both ways; while closed it's inert. Escape, the backdrop or the handle's close button dismiss it.
 */
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
    const t = useT();
    const panelRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const returnTo = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            returnTo?.focus?.();
        };
    }, [open, onClose]);

    return (
        <div className={cn("fixed inset-0 z-40 lg:hidden", !open && "pointer-events-none")} inert={!open}>
            <div aria-hidden onClick={onClose} className={cn("absolute inset-0 bg-neutral-950/35 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className={cn(
                    "absolute inset-x-0 bottom-0 flex max-h-[78svh] flex-col rounded-t-3xl border-t border-[var(--card-line)] bg-primary pb-[env(safe-area-inset-bottom)] shadow-2xl outline-none transition-transform duration-300 ease-[var(--ease-out)] motion-reduce:transition-none",
                    open ? "translate-y-0" : "translate-y-full",
                )}
            >
                <div className="flex shrink-0 items-center justify-between px-4 pt-2 pb-1">
                    <span aria-hidden className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--card-line)]" />
                    <h2 className="pt-3 text-sm font-semibold text-primary">{title}</h2>
                    <button type="button" onClick={onClose} className="mt-2 h-9 cursor-pointer rounded-lg px-3 text-sm font-medium text-[var(--brand)] outline-focus-ring hover:bg-secondary focus-visible:outline-2 pointer-coarse:h-11">
                        {t.retouch.closeSettings}
                    </button>
                </div>
                <div className="flex min-h-0 flex-col gap-6 overflow-y-auto overscroll-contain px-4 pt-2 pb-6">{children}</div>
            </div>
        </div>
    );
}
