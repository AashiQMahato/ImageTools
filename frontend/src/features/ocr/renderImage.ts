import type { Node as PMNode } from "@tiptap/pm/model";
import type { OcrDocument } from "@/lib/api/ocrApi";
import { listMarker } from "./convert";
import ocrCss from "./ocr.css?raw";

/** Grows a line's box a little, so anti-aliased letter edges are covered too. */
const pad = (height: number) => Math.max(2, height * 0.18);

interface RenderOptions {
    /** The editor's live content element (its blocks are copied, laid out as in the image). */
    content: HTMLElement;
    /** The same content as a document — for list numbering, which the page draws itself. */
    doc: PMNode;
    result: OcrDocument;
    image: Blob;
    type: "image/png" | "image/jpeg" | "image/webp";
    /** The colour of text that has none of its own. */
    ink: string;
}

/**
 * The edited text drawn back onto the original image. The original text is covered with its own paper
 * colour, then the edited text is laid out by the browser exactly as in Original layout mode, and each
 * word painted where it sits — so fonts, sizes, colours, alignment and Devanagari shaping all carry over.
 */
export async function renderEditedImage({ content, doc, result, image, type, ink, quality = 0.92 }: RenderOptions & { quality?: number }): Promise<Blob> {
    const bitmap = await createImageBitmap(image);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();

    const { pageWidth, width, height, region } = result.document;
    const origin = { x: region?.x ?? 0, y: region?.y ?? 0 };
    const scale = width / pageWidth;

    // 1. Cover the original text of every block (edited, kept or deleted) with the paper around it.
    // Tables go word by word, so the grid lines between cells survive.
    for (const block of result.blocks) {
        context.fillStyle = block.style.backgroundColor;
        const boxes = block.type === "table" ? block.lines.flatMap((line) => (line.words.length ? line.words.map((word) => word.bbox) : [line.bbox])) : block.lines.map((line) => line.bbox);
        for (const box of boxes) {
            // Table words: wider than their (tight) boxes sideways, barely beyond them vertically, where
            // the ruling lines sit close by.
            const grow = block.type === "table" ? { x: box.height * 0.3, y: Math.max(1, box.height * 0.08) } : { x: pad(box.height), y: pad(box.height) };
            context.fillRect(origin.x + box.x - grow.x, origin.y + box.y - grow.y, box.width + grow.x * 2, box.height + grow.y * 2);
        }
    }

    // 2. Lay the edited text out off-screen, as Original layout mode does, at page size.
    const pageHeight = Math.round((pageWidth * height) / width);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = `position: fixed; left: -100000px; top: 0; width: ${pageWidth}px; height: ${pageHeight}px; pointer-events: none;`;
    const style = document.createElement("style");
    style.textContent = ocrCss;
    const page = document.createElement("div");
    page.className = "ocr-page ocr-layout ocr-hide-low";
    page.style.cssText = `width: ${pageWidth}px; height: ${pageHeight}px; box-shadow: none; background: transparent; --page-ink: ${ink};`;
    const copy = content.cloneNode(true) as HTMLElement;
    copy.removeAttribute("contenteditable");
    copy.querySelectorAll(".ocr-match, .ocr-match-current").forEach((element) => element.classList.remove("ocr-match", "ocr-match-current"));
    page.append(copy);
    host.append(style, page);
    document.body.append(host);
    writeListMarkers(copy, doc);

    try {
        await document.fonts.ready;
        const pageRect = page.getBoundingClientRect();
        const segmenter = new Intl.Segmenter(undefined, { granularity: "word" });
        const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
        const words: { text: string; rect: DOMRect; element: Element }[] = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent ?? "";
            const element = node.parentElement;
            if (!element || !text.trim()) continue;
            for (const segment of segmenter.segment(text)) {
                if (!segment.segment.trim()) continue;
                const range = document.createRange();
                range.setStart(node, segment.index);
                range.setEnd(node, segment.index + segment.segment.length);
                const rect = range.getClientRects()[0];
                if (rect && rect.width > 0) words.push({ text: segment.segment, rect, element });
            }
        }

        // Make sure every face used is loaded before painting with it.
        const fontOf = (element: Element) => {
            const computed = getComputedStyle(element);
            return { computed, font: `${computed.fontStyle} ${computed.fontWeight} ${Number.parseFloat(computed.fontSize) * scale}px ${computed.fontFamily}` };
        };
        const faces = new Map<string, string>();
        for (const word of words) {
            const { font } = fontOf(word.element);
            faces.set(font, (faces.get(font) ?? "") + word.text);
        }
        await Promise.all([...faces].map(([font, sample]) => document.fonts.load(font, sample.slice(0, 200)).catch(() => [])));

        // 3. Paint each word where the browser put it.
        for (const word of words) {
            const { computed, font } = fontOf(word.element);
            const x = origin.x + (word.rect.left - pageRect.left) * scale;
            const top = origin.y + (word.rect.top - pageRect.top) * scale;
            const boxHeight = word.rect.height * scale;
            const mark = word.element.closest("mark");
            if (mark) {
                context.fillStyle = getComputedStyle(mark).backgroundColor;
                context.fillRect(x, top, word.rect.width * scale, boxHeight);
            }
            context.font = font;
            context.fillStyle = computed.color;
            context.textBaseline = "alphabetic";
            const metrics = context.measureText(word.text);
            const ascent = metrics.fontBoundingBoxAscent;
            const baseline = top + (boxHeight - (ascent + metrics.fontBoundingBoxDescent)) / 2 + ascent;
            // Exactly the width the page gave the word (a variable font's optical size can make the larger
            // canvas text a touch narrower or wider), so spacing and punctuation sit where they did.
            const stretch = metrics.width > 0 ? Math.min(1.15, Math.max(0.85, (word.rect.width * scale) / metrics.width)) : 1;
            context.save();
            context.translate(x, baseline);
            context.scale(stretch, 1);
            context.fillText(word.text, 0, 0);
            context.restore();

            const thickness = Math.max(1, Number.parseFloat(computed.fontSize) * scale * 0.06);
            context.fillStyle = computed.color;
            if (word.element.closest("u") || computed.textDecorationLine.includes("underline")) context.fillRect(x, baseline + thickness * 1.5, word.rect.width * scale, thickness);
            if (word.element.closest("s") || computed.textDecorationLine.includes("line-through")) context.fillRect(x, baseline - ascent * 0.3, word.rect.width * scale, thickness);
        }
    } finally {
        host.remove();
    }

    return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode"))), type, quality));
}

/**
 * A list's bullets and numbers are drawn by the browser outside the text, so they aren't text a
 * walker can find. Each item gets its marker as real text, in the item's own font, where the browser
 * would have put it.
 */
function writeListMarkers(root: HTMLElement, doc: PMNode) {
    const lists: PMNode[] = [];
    doc.descendants((node) => {
        if (node.type.name === "bulletList" || node.type.name === "orderedList") lists.push(node);
        return true;
    });
    root.querySelectorAll<HTMLElement>("ul, ol").forEach((element, listIndex) => {
        const list = lists[listIndex];
        if (!list) return;
        element.style.listStyle = "none";
        [...element.children].forEach((item, index) => {
            if (!(item instanceof HTMLElement) || item.tagName !== "LI") return;
            // The item's own text styling (its first run), not the paragraph's defaults.
            const text = item.querySelector("p span") ?? item.querySelector("p") ?? item;
            const computed = getComputedStyle(text);
            const marker = document.createElement("span");
            marker.textContent = listMarker(list, index);
            marker.style.cssText = `position: absolute; left: 0; top: 0; transform: translateX(calc(-100% - 0.4em)); white-space: nowrap; font: ${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} / ${computed.lineHeight} ${computed.fontFamily}; color: ${computed.color};`;
            item.style.position = "relative";
            item.prepend(marker);
        });
    });
}
