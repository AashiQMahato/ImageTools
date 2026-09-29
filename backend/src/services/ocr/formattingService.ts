import type { LayoutGroup } from "./layoutService.js";
import type { BlockStyle, Box, RecognizedLine } from "./types.js";

/** Measurements of one line's pixels. */
export interface LineInk {
    /** Median colour of the text itself, and of what's around it. */
    ink: [number, number, number];
    paper: [number, number, number];
    /** Stroke thickness relative to the line's height (bold text is thicker). */
    stroke: number;
    /** Lean of the vertical strokes, in degrees (italics lean ~10–15°). */
    slant: number;
    /** How clearly the text separates from its background (0–1): trust in the colour estimate. */
    clarity: number;
}

interface Pixels {
    data: Buffer;
    width: number;
    height: number;
}

const median = (values: number[]) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]!;
};

/** Otsu's threshold for a histogram of 0–255 values. */
function otsu(histogram: number[], total: number) {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * histogram[i]!;
    let sumB = 0;
    let weightB = 0;
    let best = 0;
    let threshold = 127;
    for (let i = 0; i < 256; i++) {
        weightB += histogram[i]!;
        if (!weightB) continue;
        const weightF = total - weightB;
        if (!weightF) break;
        sumB += i * histogram[i]!;
        const between = weightB * weightF * (sumB / weightB - (sum - sumB) / weightF) ** 2;
        if (between > best) {
            best = between;
            threshold = i;
        }
    }
    return threshold;
}

/**
 * Reads a line's pixels: separates text from background (Otsu, with the minority class as the
 * text, so light-on-dark works too), takes median colours — never a single pixel — and measures
 * stroke thickness and slant from the text mask.
 */
export function measureLine(pixels: Pixels, box: Box): LineInk | null {
    const x0 = Math.max(0, Math.floor(box.x));
    const y0 = Math.max(0, Math.floor(box.y));
    const x1 = Math.min(pixels.width, Math.ceil(box.x + box.width));
    const y1 = Math.min(pixels.height, Math.ceil(box.y + box.height));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 4 || h < 4) return null;

    const luma = new Uint8Array(w * h);
    const histogram = new Array<number>(256).fill(0);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = ((y0 + y) * pixels.width + x0 + x) * 3;
            const value = Math.round(0.299 * pixels.data[i]! + 0.587 * pixels.data[i + 1]! + 0.114 * pixels.data[i + 2]!);
            luma[y * w + x] = value;
            histogram[value]!++;
        }
    }
    const threshold = otsu(histogram, w * h);
    let dark = 0;
    for (let i = 0; i < luma.length; i++) if (luma[i]! <= threshold) dark++;
    const darkText = dark <= luma.length / 2;
    const isInk = (value: number) => (darkText ? value <= threshold : value > threshold);

    const core: [number, number, number, number][] = [];
    const paper: number[][] = [[], [], []];
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const index = y * w + x;
            const i = ((y0 + y) * pixels.width + x0 + x) * 3;
            if (isInk(luma[index]!)) {
                mask[index] = 1;
                core.push([luma[index]!, pixels.data[i]!, pixels.data[i + 1]!, pixels.data[i + 2]!]);
            } else {
                paper[0]!.push(pixels.data[i]!);
                paper[1]!.push(pixels.data[i + 1]!);
                paper[2]!.push(pixels.data[i + 2]!);
            }
        }
    }
    const inkCount = mask.reduce((sum, value) => sum + value, 0);
    if (inkCount < 8) return null;

    // Stroke thickness ≈ area / half the outline (for thin strokes).
    let edge = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask[y * w + x]) continue;
            if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[y * w + x - 1] || !mask[y * w + x + 1] || !mask[(y - 1) * w + x] || !mask[(y + 1) * w + x]) edge++;
        }
    }
    const stroke = (2 * inkCount) / Math.max(1, edge) / h;

    // Slant: the shear that best lines up vertical strokes gives the sharpest column profile.
    const sharpness = (shear: number) => {
        const columns = new Float64Array(w + h * 2);
        for (let y = 0; y < h; y++) {
            const shift = Math.round(shear * (h / 2 - y)) + h;
            for (let x = 0; x < w; x++) if (mask[y * w + x]) columns[x + shift]!++;
        }
        let total = 0;
        for (const column of columns) total += column * column;
        return total;
    };
    let bestShear = 0;
    let bestScore = sharpness(0);
    const upright = bestScore;
    for (let shear = -0.35; shear <= 0.351; shear += 0.05) {
        const score = sharpness(shear);
        if (score > bestScore * 1.02) {
            bestScore = score;
            bestShear = shear;
        }
    }
    const slant = bestScore > upright * 1.06 ? (Math.atan(bestShear) * 180) / Math.PI : 0;

    // The text's colour is its core, not its anti-aliased edge (which is most of the ink when text is
    // small or enlarged): the 30% of text pixels furthest from the background.
    core.sort((a, b) => (darkText ? a[0] - b[0] : b[0] - a[0]));
    const strongest = core.slice(0, Math.max(1, Math.round(core.length * 0.3)));
    const inkColour: [number, number, number] = [median(strongest.map((p) => p[1])), median(strongest.map((p) => p[2])), median(strongest.map((p) => p[3]))];
    const paperColour: [number, number, number] = [median(paper[0]!), median(paper[1]!), median(paper[2]!)];
    const contrast = Math.abs(0.299 * (inkColour[0] - paperColour[0]) + 0.587 * (inkColour[1] - paperColour[1]) + 0.114 * (inkColour[2] - paperColour[2]));
    return { ink: inkColour, paper: paperColour, stroke, slant, clarity: Math.min(1, contrast / 120) };
}

const hex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** Near-black stays exactly the plain text colour (scans are never truly #000). */
function textColour(ink: [number, number, number]) {
    const spread = Math.max(...ink) - Math.min(...ink);
    const lightness = (ink[0] + ink[1] + ink[2]) / 3;
    return spread < 30 && lightness < 90 ? "#1A1A1A" : hex(ink);
}

export interface StyleContext {
    /** Median stroke of the whole document's body text, the yardstick for bold. */
    bodyStroke: number;
    /** Page width in working pixels, and the editor page width they map to. */
    pageWidth: number;
    editorWidth: number;
    /** Working pixels per original pixel. */
    scale: number;
}

const DEVANAGARI = /[ऀ-ॿ]/u;

/**
 * A block's formatting, estimated from its lines' pixels and geometry. Sizes are converted from image
 * pixels to editor pixels through the page scale (never "image px = pt"); every value carries how
 * sure the estimate is.
 */
export function blockStyle(group: LayoutGroup, measured: (LineInk | null)[], context: StyleContext): BlockStyle {
    const inks = measured.filter((ink): ink is LineInk => ink !== null);
    const lines = group.lines;
    const text = lines.map((line) => line.text).join(" ");
    const devanagari = DEVANAGARI.test(text);

    // Font size: a line box covers ascenders, descenders (and for Devanagari the headline and marks),
    // so the font is a fraction of the box. Converted to the editor's page.
    const boxHeight = median(lines.map((line) => line.textHeight));
    const toEditor = context.editorWidth / context.pageWidth;
    // Capitals and figures only: no ascenders or descenders, so the box is nearer the font's size.
    const capitals = !devanagari && /[A-Z0-9]/.test(text) && !/[a-z]/.test(text);
    const share = devanagari ? 0.62 : capitals ? 0.9 : 0.72;
    const fontSize = Math.max(8, Math.min(96, Math.round(boxHeight * share * toEditor)));

    const stroke = median(inks.map((ink) => ink.stroke));
    const heavier = context.bodyStroke ? stroke / context.bodyStroke : 1;
    const fontWeight: BlockStyle["fontWeight"] = heavier > 1.3 ? 700 : heavier > 1.15 ? 600 : 400;
    const slant = median(inks.map((ink) => ink.slant));
    const italic = Math.abs(slant) >= 7 && Math.abs(slant) <= 25 && !devanagari;

    const ink = inks.length ? ([0, 1, 2].map((channel) => median(inks.map((line) => line.ink[channel]!))) as [number, number, number]) : ([26, 26, 26] as [number, number, number]);
    const paper = inks.length ? ([0, 1, 2].map((channel) => median(inks.map((line) => line.paper[channel]!))) as [number, number, number]) : ([255, 255, 255] as [number, number, number]);
    const clarity = median(inks.map((line) => line.clarity));

    // Alignment from where lines start and end, relative to each other and to the page.
    const tolerance = context.pageWidth * 0.015;
    const lefts = lines.map((line) => line.box.x);
    const rights = lines.map((line) => line.box.x + line.box.width);
    const centres = lines.map((line) => line.box.x + line.box.width / 2);
    const spreadOf = (values: number[]) => Math.max(...values) - Math.min(...values);
    let textAlign: BlockStyle["textAlign"] = "left";
    let alignConfidence = 0.5;
    if (lines.length >= 2) {
        const leftAligned = spreadOf(lefts) <= tolerance;
        const rightAligned = spreadOf(rights.slice(0, -1)) <= tolerance;
        // Justified text fills its measure: short lines that happen to end together (list items) aren't.
        const long = median(lines.map((line) => line.box.width)) > context.pageWidth * 0.45;
        if (leftAligned && rightAligned && lines.length >= 3 && long) [textAlign, alignConfidence] = ["justify", 0.7];
        else if (leftAligned) [textAlign, alignConfidence] = ["left", 0.85];
        else if (spreadOf(rights) <= tolerance) [textAlign, alignConfidence] = ["right", 0.8];
        else if (spreadOf(centres) <= tolerance * 1.5) [textAlign, alignConfidence] = ["center", 0.8];
    } else {
        const centre = centres[0]!;
        const pageCentre = context.pageWidth / 2;
        if (Math.abs(centre - pageCentre) < context.pageWidth * 0.04 && lefts[0]! > context.pageWidth * 0.12) [textAlign, alignConfidence] = ["center", 0.7];
        else if (rights[0]! > context.pageWidth * 0.85 && lefts[0]! > context.pageWidth * 0.5) [textAlign, alignConfidence] = ["right", 0.6];
    }

    // Line height: distance between line tops, as a multiple of the font size.
    const sorted = [...lines].sort((a, b) => a.box.y - b.box.y);
    const pitches = sorted.slice(1).map((line, index) => line.box.y - sorted[index]!.box.y);
    const fontInImage = boxHeight * share;
    const lineHeight = pitches.length ? Math.max(1, Math.min(2.5, Math.round((median(pitches) / fontInImage) * 10) / 10)) : devanagari ? 1.6 : 1.4;

    return {
        // The font itself can't be read from pixels: a Unicode font that covers the script is chosen.
        fontFamily: devanagari ? "Noto Sans Devanagari" : "Inter",
        fontSize,
        fontWeight,
        fontStyle: italic ? "italic" : "normal",
        color: textColour(ink),
        backgroundColor: hex(paper),
        textAlign,
        lineHeight,
        inferred: {
            fontFamily: 0.3,
            fontSize: 0.7,
            fontWeight: fontWeight === 400 ? 0.6 : Math.min(0.9, 0.5 + (heavier - 1.15)),
            fontStyle: italic ? 0.6 : 0.7,
            color: Math.round(clarity * 100) / 100,
            textAlign: alignConfidence,
            lineHeight: pitches.length ? 0.6 : 0.3,
        },
    };
}

const distance = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rgb = (colour: string): [number, number, number] => [1, 3, 5].map((start) => Number.parseInt(colour.slice(start, start + 2), 16)) as [number, number, number];

/**
 * A line's own colour and weight, only where it clearly differs from its block's — one line's
 * measurement is noisier than a block's, so small differences are left alone.
 */
export function lineStyle(ink: LineInk | null, block: BlockStyle, bodyStroke: number): Partial<Pick<BlockStyle, "color" | "fontWeight">> | undefined {
    if (!ink || ink.clarity < 0.35) return undefined;
    const style: Partial<Pick<BlockStyle, "color" | "fontWeight">> = {};
    const colour = textColour(ink.ink);
    if (colour !== block.color && distance(rgb(colour), rgb(block.color)) > 70) style.color = colour;
    const heavier = bodyStroke ? ink.stroke / bodyStroke : 1;
    if (block.fontWeight === 400 && heavier > 1.35) style.fontWeight = 700;
    else if (block.fontWeight >= 600 && heavier < 1.08) style.fontWeight = 400;
    return Object.keys(style).length ? style : undefined;
}

/** The text height all body lines share, and their typical stroke — the yardsticks for headings and bold. */
export function bodyMeasures(groups: LayoutGroup[], measured: Map<RecognizedLine, LineInk | null>) {
    const body = groups.filter((group) => group.kind === "paragraph" || group.kind === "list").flatMap((group) => group.lines);
    const source = body.length ? body : groups.flatMap((group) => group.lines);
    return { bodyStroke: median(source.map((line) => measured.get(line)?.stroke ?? 0).filter(Boolean)) };
}
