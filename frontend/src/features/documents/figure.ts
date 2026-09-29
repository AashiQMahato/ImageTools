import type { JSONContent } from "@tiptap/core";
import { mergeAttributes, Node } from "@tiptap/core";

/**
 * A picture from the original page (a photo, chart or seal), kept in its place among the text. It's
 * one unit: it can be selected, moved or deleted, not edited.
 */
export const Figure = Node.create({
    name: "figure",
    group: "block",
    atom: true,
    draggable: true,
    selectable: true,
    addAttributes() {
        return {
            src: { default: null },
            /** Its width on the page, in page pixels (816 = the page's full width). */
            width: { default: null },
            height: { default: null },
            alt: { default: "" },
        };
    },
    parseHTML() {
        return [{ tag: "figure[data-figure] img", getAttrs: (element) => ({ src: element.getAttribute("src"), width: Number(element.getAttribute("width")) || null, height: Number(element.getAttribute("height")) || null, alt: element.getAttribute("alt") ?? "" }) }];
    },
    renderHTML({ HTMLAttributes }) {
        const { src, width, height, alt } = HTMLAttributes as { src: string; width: number | null; height: number | null; alt: string };
        const size = width && height ? { width: String(Math.round(width)), height: String(Math.round(height)), style: `width:${Math.round(width)}px` } : {};
        return ["figure", { "data-figure": "", class: "doc-figure" }, ["img", mergeAttributes({ src, alt, draggable: "false" }, size)]];
    },
});

/** A figure node from a JPEG or PNG (base64). */
export const figureNode = (data: string, width: number, height: number, alt: string, type: "jpeg" | "png" = "jpeg"): JSONContent => ({ type: "figure", attrs: { src: `data:image/${type};base64,${data}`, width, height, alt } });

/** Content without its figures (for editors that don't take pictures). */
export function withoutFigures(content: JSONContent): JSONContent {
    return { ...content, content: content.content?.filter((node) => node.type !== "figure") };
}
