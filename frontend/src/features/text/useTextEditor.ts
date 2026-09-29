import type { JSONContent } from "@tiptap/core";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { BlockFormat, FindReplace } from "@/features/ocr/extensions";

/**
 * The full text editor: everything the OCR editor has (fonts, sizes, colour, highlight, alignment,
 * spacing, lists, tables, find & replace) plus headings, quotes, code, links and dividers.
 */
export function useTextEditor({ content, label, placeholder, spellcheck, onChange }: { content: JSONContent; label: string; placeholder: string; spellcheck: boolean; onChange: (content: JSONContent) => void }) {
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
                // Links don't open while editing (they would navigate away); typed URLs become links.
                link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
                undoRedo: { depth: 500 },
            }),
            TextStyleKit.configure({ lineHeight: false, backgroundColor: false }),
            TextAlign.configure({ types: ["heading", "paragraph"] }),
            Highlight.configure({ multicolor: true }),
            TableKit.configure({ table: { resizable: false } }),
            BlockFormat,
            FindReplace,
            Placeholder.configure({ placeholder }),
        ],
        content,
        shouldRerenderOnTransaction: false,
        editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox", spellcheck: String(spellcheck) } },
        onUpdate: ({ editor: current }) => onChangeRef.current(current.getJSON()),
    });

    useEffect(() => {
        editor.setOptions({ editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox", spellcheck: String(spellcheck) } } });
    }, [editor, spellcheck, label]);

    return editor;
}
