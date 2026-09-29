import type { Editor } from "@tiptap/core";

export type CaseMode = "upper" | "lower" | "title" | "sentence" | "capitalize" | "alternating";
export const CASE_MODES: readonly CaseMode[] = ["upper", "lower", "title", "sentence", "capitalize", "alternating"];

/** Short words that stay lowercase inside a title (unless first or last). */
const SMALL = new Set(["a", "an", "the", "and", "but", "or", "nor", "for", "so", "yet", "as", "at", "by", "in", "of", "off", "on", "per", "to", "up", "via", "vs"]);
const WORD = /\p{L}[\p{L}\p{M}\p{N}'’]*/gu;

/**
 * A case change. Scripts without case (Devanagari) are left as they are; letters are changed with the
 * text's own locale rules.
 */
export function convertCase(text: string, mode: CaseMode, locale?: string): string {
    const upper = (value: string) => value.toLocaleUpperCase(locale);
    const lower = (value: string) => value.toLocaleLowerCase(locale);
    const initial = (word: string) => upper(word.charAt(0)) + lower(word.slice(1));
    switch (mode) {
        case "upper":
            return upper(text);
        case "lower":
            return lower(text);
        case "capitalize":
            return text.replace(WORD, initial);
        case "title": {
            const words = [...text.matchAll(WORD)];
            return text.replace(WORD, (word, offset: number) => {
                const index = words.findIndex((match) => match.index === offset);
                // First and last words, and the first word of each sentence, are always capitalised.
                const edge = index === 0 || index === words.length - 1 || /[.!?:]\s*$/.test(text.slice(0, offset));
                return !edge && SMALL.has(lower(word)) ? lower(word) : initial(word);
            });
        }
        case "sentence":
            // Lowercase, then a capital at the start and after sentence-ending punctuation.
            return lower(text).replace(/(^\s*|[.!?।॥]\s+|\n\s*)(\p{Ll})/gu, (_, before: string, letter: string) => before + upper(letter));
        case "alternating": {
            let next = false;
            return [...text]
                .map((char) => {
                    if (lower(char) === upper(char)) return char;
                    next = !next;
                    return next ? lower(char) : upper(char);
                })
                .join("");
        }
    }
}

/**
 * Changes the case of the selection (or the whole document), keeping all formatting: each paragraph
 * is converted as one piece — so sentences are found across bold and italic — then written back run
 * by run. One undo step.
 */
export function applyCase(editor: Editor, mode: CaseMode, locale?: string) {
    const { state } = editor;
    const { from, to, empty } = state.selection;
    const start = empty ? 0 : from;
    const end = empty ? state.doc.content.size : to;
    const tr = state.tr;
    const edits: { from: number; to: number; text: string; marks: readonly import("@tiptap/pm/model").Mark[] }[] = [];
    state.doc.nodesBetween(start, end, (node, pos) => {
        if (!node.isTextblock || node.type.name === "codeBlock") return !node.isTextblock;
        const runs: { from: number; to: number; text: string; marks: readonly import("@tiptap/pm/model").Mark[] }[] = [];
        node.forEach((child, offset) => {
            if (!child.isText || child.marks.some((mark) => mark.type.name === "code")) return;
            const childFrom = pos + 1 + offset;
            const a = Math.max(childFrom, start);
            const b = Math.min(childFrom + child.nodeSize, end);
            if (a < b) runs.push({ from: a, to: b, text: child.text!.slice(a - childFrom, b - childFrom), marks: child.marks });
        });
        if (!runs.length) return false;
        const whole = runs.map((run) => run.text).join("");
        const converted = convertCase(whole, mode, locale);
        if (converted.length === whole.length) {
            let cursor = 0;
            for (const run of runs) {
                edits.push({ ...run, text: converted.slice(cursor, cursor + run.text.length) });
                cursor += run.text.length;
            }
        } else for (const run of runs) edits.push({ ...run, text: convertCase(run.text, mode, locale) });
        return false;
    });
    // From the end backwards, so earlier positions stay valid.
    for (const edit of edits.reverse()) if (edit.text !== state.doc.textBetween(edit.from, edit.to)) tr.replaceWith(edit.from, edit.to, state.schema.text(edit.text, edit.marks));
    if (tr.docChanged) editor.view.dispatch(tr);
}
