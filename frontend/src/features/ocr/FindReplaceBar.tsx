import { type Editor, useEditorState } from "@tiptap/react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { goToMatch, replaceAll, replaceCurrent, searchKey, setSearch } from "./extensions";

const iconButton =
    "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-secondary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-35 pointer-coarse:size-10";
const textButton =
    "h-8 shrink-0 cursor-pointer rounded-lg border border-[var(--card-line)] px-2.5 text-[0.8125rem] font-medium text-secondary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-10";
const inputClass =
    "h-8 min-w-0 flex-1 rounded-lg border border-[var(--card-line)] bg-primary px-2.5 text-sm text-primary outline-focus-ring placeholder:text-quaternary focus-visible:outline-2 pointer-coarse:h-10";

/**
 * Find and replace across the document, in English and Nepali alike. Replacing keeps the formatting
 * of the text it replaces; Replace all is one step to undo.
 */
export function FindReplaceBar({ editor, onClose, onReplaced }: { editor: Editor; onClose: () => void; onReplaced: (count: number) => void }) {
    const t = useT();
    const copy = t.ocr.find;
    const [query, setQuery] = useState("");
    const [replacement, setReplacement] = useState("");
    const [matchCase, setMatchCase] = useState(false);
    const findRef = useRef<HTMLInputElement>(null);
    const caseId = useId();
    const search = useEditorState({ editor, selector: ({ editor: current }) => searchKey.getState(current.state) ?? null });
    const total = search?.matches.length ?? 0;

    useEffect(() => {
        findRef.current?.focus();
        findRef.current?.select();
    }, []);
    useEffect(() => setSearch(editor, query, matchCase), [editor, query, matchCase]);
    // Leaving the search clears its highlights.
    useEffect(
        () => () => {
            if (!editor.isDestroyed) setSearch(editor, "", false);
        },
        [editor],
    );

    return (
        <div role="search" aria-label={copy.label} className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--card-line)] bg-secondary px-2 py-2 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-1">
                <input
                    ref={findRef}
                    type="search"
                    value={query}
                    placeholder={copy.find}
                    aria-label={copy.find}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.preventDefault();
                            goToMatch(editor, event.shiftKey ? -1 : 1);
                        } else if (event.key === "Escape") onClose();
                    }}
                    className={inputClass}
                />
                <span aria-live="polite" className="w-20 shrink-0 text-center text-xs text-tertiary tabular-nums">
                    {query ? copy.count(total ? (search?.index ?? 0) + 1 : 0, total) : ""}
                </span>
                <button type="button" className={iconButton} aria-label={copy.previous} title={copy.previous} disabled={!total} onClick={() => goToMatch(editor, -1)}>
                    <ChevronUp className="size-4" aria-hidden />
                </button>
                <button type="button" className={iconButton} aria-label={copy.next} title={copy.next} disabled={!total} onClick={() => goToMatch(editor, 1)}>
                    <ChevronDown className="size-4" aria-hidden />
                </button>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1">
                <input
                    type="text"
                    value={replacement}
                    placeholder={copy.replace}
                    aria-label={copy.replace}
                    onChange={(event) => setReplacement(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && total) {
                            event.preventDefault();
                            replaceCurrent(editor, replacement);
                        } else if (event.key === "Escape") onClose();
                    }}
                    className={inputClass}
                />
                <button type="button" className={textButton} disabled={!total} onClick={() => replaceCurrent(editor, replacement)}>
                    {copy.replaceOne}
                </button>
                <button type="button" className={textButton} disabled={!total} onClick={() => onReplaced(replaceAll(editor, replacement))}>
                    {copy.replaceAll}
                </button>
            </div>
            <div className="flex items-center justify-between gap-1 sm:justify-start">
                <label htmlFor={caseId} className={cn("flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-xs font-medium text-secondary pointer-coarse:h-10")}>
                    <input id={caseId} type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} className="size-3.5 accent-[var(--brand)]" />
                    {copy.matchCase}
                </label>
                <button type="button" className={iconButton} aria-label={copy.close} title={copy.close} onClick={onClose}>
                    <X className="size-4" aria-hidden />
                </button>
            </div>
        </div>
    );
}
