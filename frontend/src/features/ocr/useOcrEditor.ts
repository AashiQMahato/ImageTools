import type { JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { ActiveBlock, BlockFormat, FindReplace, LowConfidence } from "./extensions";

/**
 * The one editor both modes share (Document and Original layout are two views of the same content,
 * so there is one undo history). Formatting lives in the content itself, so every export sees it.
 */
export function useOcrEditor({ content, label, spellcheck, onChange }: { content: JSONContent; label: string; spellcheck: boolean; onChange: (content: JSONContent) => void }) {
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                code: false,
                codeBlock: false,
                blockquote: false,
                link: false,
                // In layout mode an extra empty paragraph would have no place on the page.
                trailingNode: false,
                undoRedo: { depth: 300 },
            }),
            TextStyleKit.configure({ lineHeight: false, backgroundColor: false }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Highlight.configure({ multicolor: true }),
            TableKit.configure({ table: { resizable: false } }),
            BlockFormat,
            LowConfidence,
            FindReplace,
            ActiveBlock,
        ],
        content,
        shouldRerenderOnTransaction: false,
        editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox", spellcheck: "false", autocorrect: "off", autocapitalize: "off" } },
        onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
    });

    // Spell checking is the browser's, offered only on request — and only suggestions: nothing is replaced automatically.
    useEffect(() => {
        editor.setOptions({ editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox", spellcheck: String(spellcheck), autocorrect: "off", autocapitalize: "off", lang: "en" } } });
    }, [editor, spellcheck, label]);

    return editor;
}
