import type { JSONContent } from "@tiptap/core";
import { create } from "zustand";
import { loadDraftText, saveDraftText } from "@/lib/draft";

interface TextDocumentState {
    /** The document, once loaded from this device (null: not loaded yet). */
    content: JSONContent | null;
    /** Bumped when content arrives from outside the editor (opened, imported, handed over). */
    revision: number;
    load: () => Promise<void>;
    /** From the editor, as you type (saved shortly after). */
    update: (content: JSONContent) => void;
    /** Replaces the document (a file opened, text handed over from another tool). */
    replace: (content: JSONContent) => void;
}

const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };
let timer: number | undefined;
let pending: JSONContent | null = null;
/** A synchronous copy for the moment the page closes — IndexedDB writes don't finish then. */
const LAST = "text-editor-last";
const flush = (closing = false) => {
    window.clearTimeout(timer);
    if (!pending) return;
    void saveDraftText(pending);
    if (closing) {
        try {
            localStorage.setItem(LAST, JSON.stringify({ content: pending, savedAt: Date.now() }));
        } catch {
            // Too large for local storage: the last half-second may be lost.
        }
    }
    pending = null;
};
const persist = (content: JSONContent) => {
    pending = content;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => flush(), 500);
};
// Leaving or reloading the page saves the last keystrokes too, not only those half a second old.
if (typeof window !== "undefined") window.addEventListener("pagehide", () => flush(true));

/** The closing copy, if the page was closed with changes not yet in IndexedDB. Read once, then removed. */
function takeLast(): JSONContent | null {
    try {
        const raw = localStorage.getItem(LAST);
        localStorage.removeItem(LAST);
        return raw ? ((JSON.parse(raw) as { content: JSONContent }).content ?? null) : null;
    } catch {
        return null;
    }
}

/** The one text document the text tools share (editor, cleaner, case converter, word counter). */
export const useTextDocument = create<TextDocumentState>()((set, get) => ({
    content: null,
    revision: 0,
    load: async () => {
        if (get().content) return;
        // The copy made as the page closed is newer than anything IndexedDB has.
        const last = takeLast();
        const saved = last ?? (await loadDraftText<JSONContent>());
        if (last) void saveDraftText(last);
        if (!get().content) set({ content: saved ?? EMPTY });
    },
    update: (content) => {
        set({ content });
        persist(content);
    },
    replace: (content) => {
        set((state) => ({ content, revision: state.revision + 1 }));
        void saveDraftText(content);
    },
}));

/** Marks only the OCR editor knows about (uncertain words) don't travel to the text editor. */
function strip(node: JSONContent): JSONContent {
    return {
        ...node,
        ...(node.marks ? { marks: node.marks.filter((mark) => mark.type !== "lowConfidence") } : {}),
        ...(node.content ? { content: node.content.map(strip) } : {}),
    };
}

/** Hands content (from OCR, or extracted from a PDF) to the text editor. */
export function openInTextEditor(content: JSONContent | string) {
    useTextDocument.getState().replace(typeof content === "string" ? textToContent(content) : strip(content));
}

/** Plain text → paragraphs (blank lines apart), with line breaks kept inside them. */
export function textToContent(text: string): JSONContent {
    const paragraphs = text.replace(/\r\n?/g, "\n").split(/\n{2,}/);
    return {
        type: "doc",
        content: paragraphs.map((paragraph) => {
            const lines = paragraph.split("\n");
            const content = lines.flatMap((line, index) => [...(index ? [{ type: "hardBreak" }] : []), ...(line ? [{ type: "text", text: line }] : [])]);
            return content.length ? { type: "paragraph", content } : { type: "paragraph" };
        }),
    };
}
