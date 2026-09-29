import { type Editor, Extension, Mark } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Where a block sat in the image, as fractions of the page — used by Original layout mode. */
export interface BlockLayout {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
}

const TEXT_BLOCKS = ["paragraph", "heading"];
const BLOCKS = [...TEXT_BLOCKS, "bulletList", "orderedList", "table"];
const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

/**
 * Block-level formatting the stock extensions don't have, kept on the nodes themselves so undo, copy
 * and every export see it: line spacing, space after, indent, a block background, the text's language
 * (spell checking and fonts), a list's marker style, and the block's place in the original image.
 */
export const BlockFormat = Extension.create({
    name: "blockFormat",
    addGlobalAttributes() {
        return [
            {
                types: TEXT_BLOCKS,
                attributes: {
                    lineHeight: {
                        default: null,
                        parseHTML: (element) => Number.parseFloat(element.style.lineHeight) || null,
                        renderHTML: ({ lineHeight }) => (lineHeight ? { style: `line-height: ${lineHeight}` } : {}),
                    },
                    spacing: {
                        default: null,
                        parseHTML: (element) => (element.style.marginBottom ? Number.parseFloat(element.style.marginBottom) : null),
                        renderHTML: ({ spacing }) => (spacing == null ? {} : { style: `margin-bottom: ${spacing}px` }),
                    },
                    indent: {
                        default: 0,
                        parseHTML: (element) => Number(element.dataset.indent) || 0,
                        renderHTML: ({ indent }) => (indent ? { "data-indent": indent, style: `margin-left: ${indent * 2}em` } : {}),
                    },
                },
            },
            {
                types: BLOCKS,
                attributes: {
                    background: {
                        default: null,
                        parseHTML: () => null,
                        renderHTML: ({ background }) => (background ? { "data-background": "", style: `--block-bg: ${background}` } : {}),
                    },
                    lang: {
                        default: null,
                        parseHTML: (element) => element.getAttribute("lang"),
                        // Nepali is never put through a spell checker: its suggestions would be wrong.
                        renderHTML: ({ lang }) => (lang ? { lang, ...(lang === "ne" ? { spellcheck: "false" } : {}) } : {}),
                    },
                    layout: {
                        default: null,
                        // A new block made by splitting one isn't at the old one's place in the image.
                        keepOnSplit: false,
                        parseHTML: () => null,
                        renderHTML: ({ layout }) => {
                            const box = layout as BlockLayout | null;
                            return box ? { "data-block": box.id, style: `--lx: ${pct(box.x)}; --ly: ${pct(box.y)}; --lw: ${pct(box.w)}; --lh: ${pct(box.h)}` } : {};
                        },
                    },
                },
            },
            {
                types: ["tableRow"],
                attributes: {
                    // The row's height in the image (page pixels): Original layout mode keeps each row on its own.
                    rowHeight: {
                        default: null,
                        parseHTML: () => null,
                        renderHTML: ({ rowHeight }) => (rowHeight ? { style: `--row-h: ${rowHeight}px` } : {}),
                    },
                },
            },
            {
                types: ["bulletList", "orderedList"],
                attributes: {
                    listStyle: {
                        default: null,
                        parseHTML: (element) => element.style.listStyleType || null,
                        renderHTML: ({ listStyle }) => (listStyle ? { style: `list-style-type: ${listStyle}` } : {}),
                    },
                },
            },
        ];
    },
    addKeyboardShortcuts() {
        return {
            // In Original layout mode a block is a box on the page: Enter starts a new line inside it
            // rather than a new, unplaced block. (Lists and tables keep their own Enter.)
            Enter: () => {
                if (!this.editor.view.dom.closest(".ocr-layout")) return false;
                const parent = this.editor.state.selection.$from.parent;
                if (!TEXT_BLOCKS.includes(parent.type.name) || this.editor.isActive("listItem") || this.editor.isActive("table")) return false;
                return this.editor.commands.setHardBreak();
            },
        };
    },
});

/** Sets attributes on every paragraph and heading the selection touches. */
export function setTextblockAttrs(editor: Editor, attrs: (node: PMNode) => Record<string, unknown> | null) {
    editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
            const { from, to } = state.selection;
            state.doc.nodesBetween(from, to, (node, pos) => {
                if (!TEXT_BLOCKS.includes(node.type.name)) return true;
                const next = attrs(node);
                if (next) tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...next });
                return false;
            });
            return true;
        })
        .run();
}

/** The first paragraph or heading in the selection (for showing its current setting). */
export function selectedTextblock(editor: Editor): PMNode | null {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth >= 0; depth--) {
        const node = $from.node(depth);
        if (TEXT_BLOCKS.includes(node.type.name)) return node;
    }
    return null;
}

/** The top-level block holding the cursor gets `ocr-active`, so layout mode can outline it. */
export const ActiveBlock = Extension.create({
    name: "activeBlock",
    addProseMirrorPlugins() {
        return [
            new Plugin({
                props: {
                    decorations(state) {
                        const { $from } = state.selection;
                        if ($from.depth < 1) return DecorationSet.empty;
                        const start = $from.before(1);
                        return DecorationSet.create(state.doc, [Decoration.node(start, start + $from.node(1).nodeSize, { class: "ocr-active" })]);
                    },
                },
            }),
        ];
    },
});

/** The id of the block (from the image) holding the cursor, if it came from one. */
export function activeBlockId(editor: Editor): string | null {
    const { $from } = editor.state.selection;
    return $from.depth >= 1 ? (($from.node(1).attrs.layout as BlockLayout | null)?.id ?? null) : null;
}

/** Puts the cursor at the start of the block that came from a given place in the image. */
export function focusBlock(editor: Editor, id: string) {
    let target: number | null = null;
    editor.state.doc.forEach((node, offset) => {
        if (target === null && (node.attrs.layout as BlockLayout | null)?.id === id) target = offset;
    });
    if (target === null) return;
    const selection = TextSelection.near(editor.state.doc.resolve(target + 1));
    editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
    editor.view.focus();
    editor.view.dom.querySelector(`[data-block="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ------------------------------------------------------------------ uncertain words

/**
 * A word the engine wasn't sure of. Only marked — the text itself is never altered — and removed
 * when the user marks it as checked. Typing at its edge doesn't extend it.
 */
export const LowConfidence = Mark.create({
    name: "lowConfidence",
    inclusive: false,
    addAttributes() {
        return {
            confidence: {
                default: 0,
                parseHTML: (element) => Number(element.dataset.confidence) || 0,
                renderHTML: ({ confidence }) => ({ "data-confidence": confidence }),
            },
        };
    },
    parseHTML() {
        return [{ tag: "span.ocr-low" }];
    },
    renderHTML({ HTMLAttributes }) {
        return ["span", { ...HTMLAttributes, class: "ocr-low" }, 0];
    },
});

/** Every uncertain word, in document order. */
export function uncertainRanges(doc: PMNode): { from: number; to: number; confidence: number }[] {
    const ranges: { from: number; to: number; confidence: number }[] = [];
    doc.descendants((node, pos) => {
        if (!node.isText) return true;
        const mark = node.marks.find((item) => item.type.name === "lowConfidence");
        if (!mark) return false;
        const last = ranges.at(-1);
        if (last && last.to === pos) last.to = pos + node.nodeSize;
        else ranges.push({ from: pos, to: pos + node.nodeSize, confidence: Number(mark.attrs.confidence) || 0 });
        return false;
    });
    return ranges;
}

// ------------------------------------------------------------------ find & replace

export interface SearchState {
    query: string;
    matchCase: boolean;
    matches: { from: number; to: number }[];
    /** The current match (index into `matches`). */
    index: number;
}

export const searchKey = new PluginKey<SearchState>("ocrSearch");
const EMPTY: SearchState = { query: "", matchCase: false, matches: [], index: 0 };

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches inside each paragraph, heading or cell. The query is put in NFC — the form recognised and
 * typed text is in — so Devanagari entered as separate code points still matches; case folding is
 * Unicode-aware.
 */
function findMatches(doc: PMNode, query: string, matchCase: boolean) {
    const needle = query.normalize("NFC");
    if (!needle) return [];
    const pattern = new RegExp(escape(needle), matchCase ? "gu" : "giu");
    const matches: { from: number; to: number }[] = [];
    doc.descendants((node, pos) => {
        if (!node.isTextblock) return true;
        // One character per position: text as it is, anything else (a line break) as a placeholder.
        let text = "";
        node.forEach((child) => {
            text += child.isText ? child.text! : "￼".repeat(child.nodeSize);
        });
        for (const match of text.matchAll(pattern)) {
            if (match[0].length) matches.push({ from: pos + 1 + match.index, to: pos + 1 + match.index + match[0].length });
        }
        return false;
    });
    return matches;
}

type SearchMeta = { query: string; matchCase: boolean } | { index: number };

export const FindReplace = Extension.create({
    name: "findReplace",
    addProseMirrorPlugins() {
        return [
            new Plugin<SearchState>({
                key: searchKey,
                state: {
                    init: () => EMPTY,
                    apply(tr, previous, _old, state) {
                        const meta = tr.getMeta(searchKey) as SearchMeta | undefined;
                        if (meta && "query" in meta) {
                            const matches = findMatches(state.doc, meta.query, meta.matchCase);
                            // Start from the first match after the cursor, like a word processor.
                            const after = matches.findIndex((match) => match.from >= state.selection.from);
                            return { ...meta, matches, index: after < 0 ? 0 : after };
                        }
                        if (meta && "index" in meta) return { ...previous, index: meta.index };
                        if (!tr.docChanged || !previous.query) return previous;
                        const matches = findMatches(state.doc, previous.query, previous.matchCase);
                        return { ...previous, matches, index: Math.min(previous.index, Math.max(0, matches.length - 1)) };
                    },
                },
                props: {
                    decorations(state) {
                        const search = searchKey.getState(state);
                        if (!search?.matches.length) return DecorationSet.empty;
                        return DecorationSet.create(
                            state.doc,
                            search.matches.map((match, index) => Decoration.inline(match.from, match.to, { class: index === search.index ? "ocr-match ocr-match-current" : "ocr-match" })),
                        );
                    },
                },
            }),
        ];
    },
});

export function setSearch(editor: Editor, query: string, matchCase: boolean) {
    editor.view.dispatch(editor.state.tr.setMeta(searchKey, { query, matchCase }).setMeta("addToHistory", false));
}

/** Moves to a match and brings it into view, without taking focus from the search field. */
export function goToMatch(editor: Editor, step: 1 | -1 | 0) {
    const search = searchKey.getState(editor.state);
    if (!search?.matches.length) return;
    const index = (search.index + step + search.matches.length) % search.matches.length;
    const match = search.matches[index]!;
    const tr: Transaction = editor.state.tr.setMeta(searchKey, { index }).setMeta("addToHistory", false);
    tr.setSelection(TextSelection.create(editor.state.doc, match.from, match.to)).scrollIntoView();
    editor.view.dispatch(tr);
    editor.view.dom.querySelector(".ocr-match-current")?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** Replaces the current match (keeping its formatting) — one undo step. */
export function replaceCurrent(editor: Editor, replacement: string) {
    const search = searchKey.getState(editor.state);
    const match = search?.matches[search.index];
    if (!match) return;
    const text = replacement.normalize("NFC");
    const tr = text ? editor.state.tr.insertText(text, match.from, match.to) : editor.state.tr.delete(match.from, match.to);
    editor.view.dispatch(tr);
}

/** Replaces every match in one step (one undo undoes them all). Returns how many. */
export function replaceAll(editor: Editor, replacement: string): number {
    const search = searchKey.getState(editor.state);
    if (!search?.matches.length) return 0;
    const text = replacement.normalize("NFC");
    const tr = editor.state.tr;
    for (const match of [...search.matches].reverse()) {
        if (text) tr.insertText(text, match.from, match.to);
        else tr.delete(match.from, match.to);
    }
    editor.view.dispatch(tr);
    return search.matches.length;
}
