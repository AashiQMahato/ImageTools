import type { Node as PMNode } from "@tiptap/pm/model";
import { AlignmentType, Document, HeadingLevel, type ILevelsOptions, LevelFormat, Packer, PageBreak, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { listMarker, primaryFamily } from "./convert";

const hex = (colour: string | null | undefined) => {
    if (!colour) return undefined;
    const match = /^#?([0-9a-f]{6})$/i.exec(colour.trim()) ?? /^#?([0-9a-f]{3})$/i.exec(colour.trim());
    if (!match) {
        const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(colour);
        return rgb ? rgb.slice(1, 4).map((value) => Number(value).toString(16).padStart(2, "0")).join("").toUpperCase() : undefined;
    }
    const value = match[1]!;
    return (value.length === 3 ? [...value].map((digit) => digit + digit).join("") : value).toUpperCase();
};

/** Word's font slots: Latin text uses the chosen font; Devanagari (a "complex script" to Word) its Devanagari partner. */
function fonts(stack: string | null | undefined) {
    const families = (stack ?? "").split(",").map((family) => family.trim().replace(/^["']|["']$/g, ""));
    const latin = primaryFamily(stack);
    const devanagari = families.find((family) => /devanagari/i.test(family)) ?? "Nirmala UI";
    return { ascii: latin, hAnsi: latin, cs: devanagari, eastAsia: latin };
}

const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED } as const;
const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 } as const;
const FORMATS: Record<string, (typeof LevelFormat)[keyof typeof LevelFormat]> = {
    decimal: LevelFormat.DECIMAL,
    devanagari: LevelFormat.HINDI_NUMBERS,
    "lower-alpha": LevelFormat.LOWER_LETTER,
    "upper-alpha": LevelFormat.UPPER_LETTER,
    "lower-roman": LevelFormat.LOWER_ROMAN,
    "upper-roman": LevelFormat.UPPER_ROMAN,
};

/** Page pixels → Word's half-points (1px = 0.75pt). */
const halfPoints = (px: number) => Math.round(px * 1.5);

function runs(block: PMNode, lang: string | null): TextRun[] {
    const out: TextRun[] = [];
    block.forEach((child) => {
        if (child.type.name === "hardBreak") return void out.push(new TextRun({ break: 1 }));
        if (!child.isText) return;
        const mark = (name: string) => child.marks.find((item) => item.type.name === name);
        const style = mark("textStyle")?.attrs ?? {};
        const size = style.fontSize ? halfPoints(Number.parseFloat(style.fontSize as string)) : undefined;
        const bold = Boolean(mark("bold"));
        const italics = Boolean(mark("italic"));
        const highlight = mark("highlight");
        out.push(
            new TextRun({
                text: child.text!,
                bold,
                boldComplexScript: bold,
                italics,
                italicsComplexScript: italics,
                underline: mark("underline") ? {} : undefined,
                strike: Boolean(mark("strike")),
                color: hex(style.color as string | undefined),
                size,
                sizeComplexScript: size,
                font: style.fontFamily ? fonts(style.fontFamily as string) : undefined,
                shading: highlight ? { type: ShadingType.CLEAR, fill: hex((highlight.attrs.color as string) ?? "#fef08a") ?? "FEF08A", color: "auto" } : undefined,
                language: lang === "ne" ? { value: "ne-NP", bidirectional: "ne-NP" } : lang === "en" ? { value: "en-US" } : undefined,
            }),
        );
    });
    return out;
}

function paragraph(block: PMNode, lang: string | null, extra: Partial<ConstructorParameters<typeof Paragraph>[0] & object> = {}): Paragraph {
    const attrs = block.attrs;
    const level = block.type.name === "heading" ? (attrs.level as 1 | 2 | 3) : null;
    const background = hex(attrs.background as string | null);
    return new Paragraph({
        children: runs(block, lang),
        heading: level ? HEADINGS[level] : undefined,
        alignment: ALIGN[(attrs.textAlign as keyof typeof ALIGN) ?? "left"] ?? AlignmentType.LEFT,
        spacing: {
            ...(attrs.lineHeight ? { line: Math.round(Number(attrs.lineHeight) * 240) } : {}),
            after: attrs.spacing != null ? Math.round(Number(attrs.spacing) * 15) : 160,
        },
        indent: attrs.indent ? { left: Number(attrs.indent) * 720 } : undefined,
        shading: background ? { type: ShadingType.CLEAR, fill: background, color: "auto" } : undefined,
        ...extra,
    });
}

/**
 * The document as Word: headings as headings, lists as real (numbered) lists, tables as tables, and
 * the formatting — fonts with a Devanagari partner, sizes, colours, alignment and spacing — kept.
 */
export async function exportDocx(pages: PMNode | readonly PMNode[], title: string): Promise<Blob> {
    const docs: readonly PMNode[] = Array.isArray(pages) ? (pages as readonly PMNode[]) : [pages as PMNode];
    const numbering: { reference: string; levels: ILevelsOptions[] }[] = [];
    const children: (Paragraph | Table)[] = [];

    const list = (node: PMNode, depth: number, lang: string | null) => {
        const reference = `list-${numbering.length}`;
        const style = (node.attrs.listStyle as string | null) ?? (node.type.name === "orderedList" ? "decimal" : "disc");
        const ordered = node.type.name === "orderedList";
        const levels: ILevelsOptions[] = Array.from({ length: 4 }, (_, level) => ({
            level,
            format: ordered ? (FORMATS[style] ?? LevelFormat.DECIMAL) : LevelFormat.BULLET,
            text: ordered ? `%${level + 1}.` : listMarker(node, 0),
            start: ordered ? Number(node.attrs.start) || 1 : undefined,
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720 * (level + depth + 1), hanging: 360 } } },
        }));
        numbering.push({ reference, levels });
        node.forEach((item) => {
            item.forEach((child) => {
                if (child.type.name === "bulletList" || child.type.name === "orderedList") list(child, depth + 1, lang);
                else children.push(paragraph(child, lang, { numbering: { reference, level: 0 }, spacing: { after: 60 } }));
            });
        });
    };

    docs.forEach((doc, index) => {
        // Each page of a PDF starts on a new page, as it did.
        if (index) children.push(new Paragraph({ children: [new PageBreak()] }));
        doc.forEach((block) => {
            const lang = (block.attrs.lang as string | null) ?? null;
            switch (block.type.name) {
                case "bulletList":
                case "orderedList":
                    return list(block, 0, lang);
                case "table": {
                    const rows: TableRow[] = [];
                    block.forEach((row) => {
                        const cells: TableCell[] = [];
                        row.forEach((cell) => {
                            const paragraphs: Paragraph[] = [];
                            cell.forEach((child) => void paragraphs.push(paragraph(child, lang, { spacing: { after: 0 } })));
                            cells.push(new TableCell({ children: paragraphs.length ? paragraphs : [new Paragraph("")], margins: { top: 60, bottom: 60, left: 100, right: 100 } }));
                        });
                        rows.push(new TableRow({ children: cells }));
                    });
                    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
                    children.push(new Paragraph(""));
                    return;
                }
                case "horizontalRule":
                    return void children.push(new Paragraph({ border: { bottom: { style: "single", size: 6, color: "999999", space: 1 } } }));
                default:
                    children.push(paragraph(block, lang));
            }
        });
    });

    const document = new Document({
        title,
        creator: "Studio Tools",
        numbering: { config: numbering },
        styles: { default: { document: { run: { font: { ascii: "Calibri", hAnsi: "Calibri", cs: "Nirmala UI" } } } } },
        sections: [{ children }],
    });
    return Packer.toBlob(document);
}
