import { Redo2, SlidersHorizontal, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { RETOUCH_TOOLS, type RetouchTool, TOOL_ICONS, toolLabels } from "./modes";

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
    /** Which tools to offer (retouch: brush, eraser, move). */
    tools?: readonly RetouchTool[];
    /** Extra buttons before undo/redo (e.g. the watermark remover's Auto detect). */
    extra?: ReactNode;
}

/** Phones and tablets: the tools in one row under the image, thumb-reachable, with the main action at the end. */
export function RetouchToolbar({ tool, onToolChange, paintable, canUndo, canRedo, onUndo, onRedo, onOpenSettings, action, tools = RETOUCH_TOOLS, extra }: RetouchToolbarProps) {
    const t = useT();
    const copy = t.retouch;
    const item =
        "flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[0.6875rem] font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-35 min-h-12";
    const labels = toolLabels(t);

    return (
        <div role="toolbar" aria-label={copy.tools} className="flex items-center gap-1 rounded-2xl border border-[var(--card-line)] bg-primary p-1 lg:hidden">
            {tools.map((id) => {
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
                        <span className="truncate">{labels[id].short}</span>
                    </button>
                );
            })}
            {extra}
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
