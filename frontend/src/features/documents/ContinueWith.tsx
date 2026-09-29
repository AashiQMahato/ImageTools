import { ChevronDown, LoaderCircle } from "lucide-react";
import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TOOL_ICONS } from "@/components/layout/toolIcons";
import type { ToolKey } from "@/lib/constants/navigation";
import { TOOL_CATALOG } from "@/lib/constants/toolCatalog";
import { cn } from "@/lib/utils/cn";
import { useHandoff } from "@/store/useHandoff";
import { useT } from "@/i18n";
import { type HandoffKind, NEXT } from "./handoff";

/**
 * "Continue with…": the result opened straight in the next tool — no download, no upload from the
 * device. The files move in memory, never stored.
 */
/** Shown before "More tools". */
const FIRST = 6;

export function ContinueWith({ kind, current, files, className }: { kind: HandoffKind; current: ToolKey; files: () => Promise<File[]>; className?: string }) {
    const t = useT();
    const copy = t.documents.handoff;
    const navigate = useNavigate();
    const [busy, setBusy] = useState<ToolKey | null>(null);
    const [failed, setFailed] = useState(false);
    const [more, setMore] = useState(false);
    const titleId = useId();
    const tools = NEXT[kind].filter((key) => key !== current).flatMap((key) => TOOL_CATALOG.filter((tool) => tool.key === key));
    if (!tools.length) return null;
    const shown = more ? tools : tools.slice(0, FIRST);

    const go = async (key: ToolKey, href: string) => {
        setBusy(key);
        setFailed(false);
        try {
            useHandoff.getState().send(await files(), current);
            navigate(href);
        } catch {
            setFailed(true);
            setBusy(null);
        }
    };

    return (
        <section aria-labelledby={titleId} className={cn("flex flex-col gap-3", className)}>
            <h3 id={titleId} className="text-sm font-semibold text-primary">
                {copy.title}
            </h3>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {shown.map((tool) => {
                    const Icon = TOOL_ICONS[tool.key];
                    return (
                        <li key={tool.key}>
                            <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void go(tool.key, tool.href)}
                                className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--card-line)] bg-primary px-2.5 py-2 text-left outline-focus-ring transition-colors duration-150 hover:bg-primary_hover focus-visible:outline-2 disabled:cursor-wait disabled:opacity-70"
                            >
                                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary">
                                    {busy === tool.key ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Icon className="size-4" aria-hidden />}
                                </span>
                                <span className="min-w-0 text-sm leading-tight font-medium text-primary">{t.nav.toolItems[tool.key].title}</span>
                            </button>
                        </li>
                    );
                })}
            </ul>
            {tools.length > FIRST && (
                <button type="button" onClick={() => setMore((value) => !value)} aria-expanded={more} className="flex cursor-pointer items-center gap-1 self-start rounded-lg px-1 text-xs font-medium text-[var(--brand)] outline-focus-ring hover:underline focus-visible:outline-2">
                    {more ? copy.fewer : copy.more(tools.length - FIRST)}
                    <ChevronDown className={cn("size-3.5 transition-transform", more && "rotate-180")} aria-hidden />
                </button>
            )}
            {failed && (
                <p role="alert" className="text-xs text-error-primary">
                    {copy.failed}
                </p>
            )}
            <p className="text-xs text-tertiary">{copy.note}</p>
        </section>
    );
}
