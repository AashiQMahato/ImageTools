/** Languages the user can ask for. "mixed" reads English and Nepali together. */
export type OcrLanguage = "auto" | "en" | "ne" | "mixed";
export type DetectedLanguage = "en" | "ne" | "mixed" | "unknown";

/** A rectangle in pixels of the image it belongs to. */
export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ------------------------------------------------------------------ what a provider returns

export interface RecognizedWord {
    text: string;
    box: Box;
    confidence: number;
    /** The engine gave only the line's box; this word's box is apportioned from it. */
    approximate?: boolean;
}

export interface RecognizedLine {
    text: string;
    confidence: number;
    /** Axis-aligned bounds. */
    box: Box;
    /** The text's own height, measured across the (possibly tilted) line — not inflated by a tilt. */
    textHeight: number;
    words: RecognizedWord[];
}

/** A layout model's region: what kind of content sits where. */
export interface LayoutRegion {
    label: string;
    score: number;
    box: Box;
}

export interface Recognition {
    width: number;
    height: number;
    language: DetectedLanguage;
    lines: RecognizedLine[];
    regions: LayoutRegion[];
}

export interface OcrOptions {
    language: OcrLanguage;
    layout: boolean;
}

/** Contract every OCR engine implements, so engines can be swapped without touching the pipeline. */
export interface OcrProvider {
    readonly name: string;
    /** Whether it has layout analysis of its own (otherwise layout comes from geometry alone). */
    readonly layoutAware: boolean;
    isAvailable(): Promise<boolean>;
    recognize(image: Buffer, options: OcrOptions, signal: AbortSignal): Promise<Recognition>;
    /** How far the page's content is turned clockwise (0/90/180/270), for engines that can tell. */
    detectOrientation?(image: Buffer, signal: AbortSignal): Promise<number>;
}

// ------------------------------------------------------------------ the document the editor works with

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
    /** Where this line clearly differs from its block (a red bold label above plain text), also estimated. */
    style?: Partial<Pick<BlockStyle, "color" | "fontWeight">>;
}

/**
 * Formatting read from the pixels. None of it is the original's exact font data — `inferred` says,
 * per property, how sure the estimate is (0–1).
 */
export interface BlockStyle {
    fontFamily: string;
    /** In editor pixels (see `document.pageWidth`). */
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
    /** Lines joined with "\n" — line breaks exactly as in the image. */
    text: string;
    /** Where it is in the (original) image, in pixels. */
    bbox: Box;
    /** Where it goes on the editor's page, as fractions of the page (0–1). */
    editorBox: Box;
    confidence: number;
    language: "en" | "ne" | "mixed";
    lines: DocLine[];
    list?: { ordered: boolean; items: { marker: string; text: string }[] };
    /** Cell texts by row, and each column's share of the table's width. */
    table?: { rows: string[][]; columns: number[]; rowHeights: number[] };
    style: BlockStyle;
}

export interface OcrDocument {
    document: {
        /** The image (or selected region) in pixels. */
        width: number;
        height: number;
        background: string;
        /** Editor page width in CSS pixels; heights follow the image's aspect ratio. */
        pageWidth: number;
        /** Where the region sits in the full image, when only part of it was read. */
        region: Box | null;
        /**
         * Degrees the image was turned clockwise to read it (a sideways or upside-down page). Every box
         * is in the turned image; the editor turns its copy the same way.
         */
        rotation: 0 | 90 | 180 | 270;
    };
    language: DetectedLanguage;
    blocks: DocBlock[];
    stats: { blocks: number; lines: number; words: number; averageConfidence: number; lowConfidenceWords: number };
    engine: { provider: string; layout: "model" | "geometry" };
}
