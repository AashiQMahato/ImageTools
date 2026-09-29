import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PageText } from "./PdfPage";

/** A match: which page, and where in that page's text (its items joined end to end). */
export interface Match {
    page: number;
    start: number;
    end: number;
}

const texts = new WeakMap<PDFDocumentProxy, Promise<string[][]>>();

/**
 * Every page's text items, in the same order (and split) as the text layer's runs — read once per
 * document, on the first search.
 */
export function documentText(document: PDFDocumentProxy): Promise<string[][]> {
    let pending = texts.get(document);
    if (!pending) {
        pending = (async () => {
            const pages: string[][] = [];
            for (let number = 1; number <= document.numPages; number++) {
                const content = await (await document.getPage(number)).getTextContent();
                pages.push(content.items.flatMap((item) => ("str" in item ? [item.str] : [])));
            }
            return pages;
        })();
        pending.catch(() => texts.delete(document));
        texts.set(document, pending);
    }
    return pending;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The query as a pattern: spaces match any spacing (or none — PDFs often store words without them). */
export function searchPattern(query: string, matchCase: boolean): RegExp | null {
    const words = query.normalize("NFC").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return new RegExp(words.map(escape).join("\\s*"), `g${matchCase ? "" : "i"}u`);
}

export function findMatches(pages: readonly string[][], pattern: RegExp): Match[] {
    const matches: Match[] = [];
    pages.forEach((items, index) => {
        const text = items.join("");
        for (const found of text.matchAll(pattern)) {
            if (!found[0]) continue;
            matches.push({ page: index + 1, start: found.index, end: found.index + found[0].length });
            if (matches.length >= 5000) return;
        }
    });
    return matches;
}

/** Where a match is on its page, as boxes in CSS pixels from the page's top left. */
export function matchRects(text: PageText, match: Match): { x: number; y: number; width: number; height: number }[] {
    const page = text.container.parentElement;
    if (!page) return [];
    const origin = page.getBoundingClientRect();
    const rects: { x: number; y: number; width: number; height: number }[] = [];
    let offset = 0;
    text.items.forEach((item, index) => {
        const from = Math.max(match.start, offset);
        const to = Math.min(match.end, offset + item.length);
        const node = text.divs[index]?.firstChild;
        if (from < to && node && node.nodeType === Node.TEXT_NODE) {
            const range = document.createRange();
            range.setStart(node, Math.min(from - offset, node.textContent!.length));
            range.setEnd(node, Math.min(to - offset, node.textContent!.length));
            for (const rect of range.getClientRects()) {
                if (rect.width && rect.height) rects.push({ x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height });
            }
        }
        offset += item.length;
    });
    return rects;
}
