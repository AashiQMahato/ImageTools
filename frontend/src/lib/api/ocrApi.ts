import { postNdjson } from "./ndjson";

export type OcrLanguage = "auto" | "en" | "ne" | "mixed";
export type DetectedLanguage = "en" | "ne" | "mixed" | "unknown";
export type OcrStage = "prepare" | "read" | "layout" | "paragraphs" | "formatting" | "document";

export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** The part of the image to read, in image pixels. */
export type OcrRegion = { type: "rect"; box: Box } | { type: "polygon"; points: [number, number][] };

export type BlockType = "title" | "heading" | "paragraph" | "list" | "table" | "caption" | "header" | "footer";

export interface DocWord {
    text: string;
    bbox: Box;
    confidence: number;
}

export interface DocLine {
    id: string;
    text: string;
    bbox: Box;
    confidence: number;
    words: DocWord[];
    /** Where the line clearly differs from its block (also estimated). */
    style?: Partial<Pick<BlockStyle, "color" | "fontWeight">>;
    /** Runs in their own style, where a line mixes them (read from a PDF's text, not estimated). */
    spans?: { text: string; bold: boolean; italic: boolean; color: string | null }[];
}

/** Formatting estimated from the pixels — never the original's exact font data. `inferred`: how sure, per property (0–1). */
export interface BlockStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: 400 | 600 | 700;
    fontStyle: "normal" | "italic";
    color: string;
    backgroundColor: string;
    textAlign: "left" | "center" | "right" | "justify";
    lineHeight: number;
    inferred: Partial<Record<"fontFamily" | "fontSize" | "fontWeight" | "fontStyle" | "color" | "textAlign" | "lineHeight", number>>;
}

export interface DocBlock {
    id: string;
    type: BlockType;
    text: string;
    /** In the image (or region), in pixels. */
    bbox: Box;
    /** On the editor's page, as fractions of it. */
    editorBox: Box;
    confidence: number;
    language: "en" | "ne" | "mixed";
    lines: DocLine[];
    list?: { ordered: boolean; items: { marker: string; text: string }[] };
    /** Cell texts by row, and each column's share of the table's width. */
    table?: { rows: string[][]; columns?: number[]; rowHeights?: number[] };
    style: BlockStyle;
}

export interface OcrDocument {
    /** `rotation`: degrees the page was turned clockwise to read it (it was sideways or upside down). */
    document: { width: number; height: number; background: string; pageWidth: number; region: Box | null; rotation?: 0 | 90 | 180 | 270 };
    language: DetectedLanguage;
    blocks: DocBlock[];
    stats: { blocks: number; lines: number; words: number; averageConfidence: number; lowConfidenceWords: number };
    engine: { provider: string; layout: "model" | "geometry" };
}

export interface StageEvent {
    type: "stage";
    stage: OcrStage;
    status: "active" | "done";
    detail?: Record<string, unknown>;
}

/** Reading can take a while on a large page (and the first run loads the models). */
const TIMEOUT_MS = 240_000;

/** Reads the text in an image, reporting each stage as the server works through it. */
export function extractText(
    image: Blob,
    fileName: string,
    options: { language: OcrLanguage; region: OcrRegion | null; preserveLayout: boolean },
    onEvent: (event: StageEvent) => void,
    signal?: AbortSignal,
): Promise<OcrDocument> {
    const form = new FormData();
    form.append("language", options.language);
    form.append("preserveLayout", String(options.preserveLayout));
    if (options.region) form.append("region", JSON.stringify(options.region));
    form.append("file", image, fileName || "image.png");
    return postNdjson<OcrDocument, StageEvent>("/ocr", form, onEvent, { signal, timeoutMs: TIMEOUT_MS });
}
