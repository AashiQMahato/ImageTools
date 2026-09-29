import { printDocument } from "@/features/ocr/printPdf";

const escapeHtml = (value: string) => value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);

/** Plain text as Word: a paragraph per line, each page of the PDF on its own page. */
export async function textToDocx(pages: readonly string[], title: string): Promise<Blob> {
    const { Document, Packer, PageBreak, Paragraph, TextRun } = await import("docx");
    // Devanagari is a complex script to Word: it needs its own font slot.
    const font = { ascii: "Calibri", hAnsi: "Calibri", cs: "Nirmala UI", eastAsia: "Calibri" };
    const children = pages.flatMap((text, index) => [
        ...(index ? [new Paragraph({ children: [new PageBreak()] })] : []),
        ...text.split("\n").map((line) => new Paragraph({ children: [new TextRun({ text: line, font, size: 22, sizeComplexScript: 22 })], spacing: { after: 80 } })),
    ]);
    return Packer.toBlob(new Document({ title, creator: "Studio Tools", sections: [{ children }] }));
}

/** Plain text as PDF, through the browser's print pipeline (so Devanagari is shaped as on screen). */
export function textToPdf(pages: readonly string[], title: string, lang: string) {
    return printDocument({
        pages: pages.map((text) => ({
            html: text
                .split(/\n{2,}/)
                .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
                .join(""),
            layout: null,
            colours: { background: "#ffffff", ink: "#1a1a1a" },
        })),
        title,
        lang,
    });
}
