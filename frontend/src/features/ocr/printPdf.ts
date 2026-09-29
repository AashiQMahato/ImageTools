import ocrCss from "./ocr.css?raw";

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

export interface PrintPage {
    /** The editor's HTML for the page. */
    html: string;
    /** Original layout: the page at the image's proportions. Otherwise flowing text on A4. */
    layout: { width: number; height: number } | null;
    colours: { background: string; ink: string };
}

interface PrintOptions {
    /** One or more pages (a PDF's pages each start a new sheet). */
    pages: readonly PrintPage[];
    title: string;
    lang: string;
}

/**
 * PDF through the browser's own print pipeline ("Save as PDF"): the text stays real, selectable text,
 * and Devanagari is shaped by the browser exactly as on screen — which a hand-built PDF can't promise.
 */
export function printDocument({ pages, title, lang }: PrintOptions): Promise<void> {
    const { layout, colours } = pages[0]!;
    // The page's own font stylesheet (Inter, Noto Sans/Serif and their Devanagari faces).
    const fontLinks = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]')].map((link) => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`).join("");
    const pageRule = layout ? `@page { size: ${layout.width}px ${layout.height}px; margin: 0; }` : "@page { size: A4; margin: 16mm 18mm; }";
    const pageStyle = layout ? "" : ".ocr-page { width: auto; } .ocr-page .ProseMirror { padding: 0 !important; }";
    const sheets = pages
        .map((page, index) => {
            const size = page.layout ? ` width: ${page.layout.width}px; height: ${page.layout.height}px;` : "";
            const breakAfter = index < pages.length - 1 ? " break-after: page;" : "";
            return `<div class="ocr-page ocr-hide-low${page.layout ? " ocr-layout" : ""}" style="--page-bg: ${page.colours.background}; --page-ink: ${page.colours.ink};${size}${breakAfter}"><div class="ProseMirror">${page.html}</div></div>`;
        })
        .join("");
    const source = `<!doctype html><html lang="${escapeHtml(lang)}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${fontLinks}<style>
${ocrCss}
${pageRule}
html, body { margin: 0; background: ${colours.background}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.ocr-page { box-shadow: none; border-radius: 0; }
${pageStyle}
.ocr-page h1, .ocr-page h2, .ocr-page h3 { break-after: avoid; }
.ocr-page tr, .ocr-page li { break-inside: avoid; }
</style></head><body>${sheets}</body></html>`;

    return new Promise((resolve, reject) => {
        const frame = document.createElement("iframe");
        frame.setAttribute("aria-hidden", "true");
        frame.style.cssText = "position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0; visibility: hidden;";
        let removed = false;
        const remove = () => {
            if (removed) return;
            removed = true;
            frame.remove();
        };
        frame.onload = async () => {
            const view = frame.contentWindow;
            const doc = frame.contentDocument;
            if (!view || !doc) {
                remove();
                return reject(new Error("print frame"));
            }
            try {
                // Every face in use must be loaded, or the PDF would fall back to other fonts.
                await doc.fonts.ready;
                view.addEventListener("afterprint", () => window.setTimeout(remove, 100));
                view.focus();
                view.print();
                resolve();
                // Browsers that don't report afterprint still get tidied up.
                window.setTimeout(remove, 60_000);
            } catch (error) {
                remove();
                reject(error instanceof Error ? error : new Error("print"));
            }
        };
        frame.srcdoc = source;
        document.body.append(frame);
    });
}
