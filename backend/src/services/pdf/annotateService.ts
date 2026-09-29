import { readFile } from "node:fs/promises";
import { BlendMode, LineCapStyle, type PDFFont, type PDFImage, rgb } from "pdf-lib";
import sharp from "sharp";
import { AppError } from "../../utils/AppError.js";
import { safeDocumentName } from "../../utils/http.js";
import type { JobContext } from "../jobs/jobService.js";
import { loadPdf, savePdf } from "./pdfDocument.js";
import { hexColour, imageStamp, placeCentred, textStamp, toPdf, type VisualPage, visualPage } from "./stamp.js";

/**
 * What the PDF editor adds, on top of the page (the original content is never changed). Positions
 * are points on the page as the reader sees it: top-left origin, the page's rotation applied.
 */
export type Annotation =
    | { kind: "text"; page: number; x: number; y: number; width: number; height: number; rotation: number; text: string; size: number; color: string; bold: boolean }
    | { kind: "image"; page: number; x: number; y: number; width: number; height: number; rotation: number; image: string; opacity: number }
    | { kind: "ink"; page: number; strokes: [number, number][][]; color: string; width: number; opacity: number }
    | { kind: "highlight" | "underline" | "strike"; page: number; rects: { x: number; y: number; width: number; height: number }[]; color: string }
    | { kind: "rect" | "ellipse"; page: number; x: number; y: number; width: number; height: number; stroke: string; strokeWidth: number; fill: string | null; opacity: number }
    | { kind: "line" | "arrow"; page: number; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; opacity: number };

const LIMITS = { annotations: 2000, points: 50_000, text: 5000 };
const bad = () => new AppError("The edits couldn't be read. Please try again.", 400, "INVALID_REQUEST");
const finite = (value: unknown, min = -1e5, max = 1e5): value is number => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const colour = (value: unknown) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/** Every annotation checked: known kinds, numbers in range, sizes capped. */
export function parseAnnotations(value: unknown, pageCount?: number): Annotation[] {
    let list: unknown;
    try {
        list = JSON.parse(String(value ?? "[]"));
    } catch {
        throw bad();
    }
    if (!Array.isArray(list) || list.length > LIMITS.annotations) throw bad();
    let points = 0;
    return list.map((raw) => {
        const item = raw as Record<string, unknown>;
        if (!Number.isInteger(item.page) || (item.page as number) < 1 || (pageCount && (item.page as number) > pageCount)) throw bad();
        switch (item.kind) {
            case "text":
                if (![item.x, item.y, item.width, item.height].every((n) => finite(n)) || !finite(item.rotation, -360, 360) || !finite(item.size, 4, 300) || !colour(item.color) || typeof item.text !== "string" || item.text.length > LIMITS.text) throw bad();
                return { ...item, bold: Boolean(item.bold) } as Annotation;
            case "image":
                if (![item.x, item.y, item.width, item.height].every((n) => finite(n)) || !finite(item.rotation, -360, 360) || !finite(item.opacity, 0.05, 1) || typeof item.image !== "string" || !/^[\w-]{1,64}$/.test(item.image)) throw bad();
                return item as Annotation;
            case "ink": {
                const strokes = item.strokes;
                if (!Array.isArray(strokes) || !colour(item.color) || !finite(item.width, 0.25, 50) || !finite(item.opacity, 0.05, 1)) throw bad();
                for (const stroke of strokes) {
                    if (!Array.isArray(stroke)) throw bad();
                    points += stroke.length;
                    if (points > LIMITS.points || !stroke.every((point) => Array.isArray(point) && point.length === 2 && finite(point[0]) && finite(point[1]))) throw bad();
                }
                return item as Annotation;
            }
            case "highlight":
            case "underline":
            case "strike":
                if (!Array.isArray(item.rects) || item.rects.length > 500 || !colour(item.color) || !(item.rects as Record<string, unknown>[]).every((rect) => [rect.x, rect.y, rect.width, rect.height].every((n) => finite(n)))) throw bad();
                return item as Annotation;
            case "rect":
            case "ellipse":
                if (![item.x, item.y, item.width, item.height].every((n) => finite(n)) || !colour(item.stroke) || !finite(item.strokeWidth, 0, 50) || !(item.fill === null || colour(item.fill)) || !finite(item.opacity, 0.05, 1)) throw bad();
                return item as Annotation;
            case "line":
            case "arrow":
                if (![item.x1, item.y1, item.x2, item.y2].every((n) => finite(n)) || !colour(item.stroke) || !finite(item.strokeWidth, 0.25, 50) || !finite(item.opacity, 0.05, 1)) throw bad();
                return item as Annotation;
            default:
                throw bad();
        }
    });
}

const toRgb = (value: string) => {
    const { r, g, b } = hexColour(value);
    return rgb(r, g, b);
};

/** A box the reader sees → the same box in the page's own coordinates (quarter turns keep boxes boxes). */
function pdfRect(target: VisualPage, x: number, y: number, width: number, height: number) {
    const a = toPdf(target, x, y);
    const b = toPdf(target, x + width, y + height);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
}

/** A path through points the reader sees, as an SVG path in page coordinates (drawSvgPath flips y). */
const svgPath = (target: VisualPage, points: [number, number][]) =>
    points
        .map(([x, y], index) => {
            const p = toPdf(target, x, y);
            return `${index ? "L" : "M"}${p.x.toFixed(2)} ${(-p.y).toFixed(2)}`;
        })
        .join(" ");

/**
 * The edits drawn into the PDF: text (vector, or shaped Devanagari), images and signatures, ink,
 * highlight / underline / strike-through, shapes and arrows — then any deleted pages removed.
 */
export async function annotatePdf(input: { path: string; name: string }, annotations: Annotation[], deletePages: number[], images: Map<string, string>, context: JobContext, purpose: "edit" | "sign" = "edit") {
    context.progress("reading");
    const document = await loadPdf(input.path);
    const count = document.getPageCount();
    if (annotations.some((item) => item.page > count) || deletePages.some((page) => page < 1 || page > count)) throw bad();
    if (new Set(deletePages).size >= count) throw new AppError("A PDF needs at least one page — keep at least one.", 400, "INVALID_PAGES");
    const fonts = new Map<string, PDFFont>();
    const embedded = new Map<string, PDFImage>();

    for (const [index, item] of annotations.entries()) {
        if (context.signal.aborted) return;
        context.progress("editing", index, annotations.length);
        const target = visualPage(document.getPage(item.page - 1));
        const page = target.page;
        switch (item.kind) {
            case "text": {
                // Each line placed in the box, the whole box turned about its centre.
                const lines = item.text.split("\n");
                const lineHeight = item.size * 1.25;
                const centre = { x: item.x + item.width / 2, y: item.y + item.height / 2 };
                const radians = (item.rotation * Math.PI) / 180;
                for (const [row, line] of lines.entries()) {
                    if (!line.trim()) continue;
                    const stamp = await textStamp(document, line, { size: item.size, color: hexColour(item.color), bold: item.bold }, fonts);
                    // The line's own centre, in the box, before turning.
                    const local = { x: item.x + stamp.width / 2 - centre.x, y: item.y + lineHeight * (row + 0.5) - centre.y };
                    const turned = { x: centre.x + local.x * Math.cos(radians) - local.y * Math.sin(radians), y: centre.y + local.x * Math.sin(radians) + local.y * Math.cos(radians) };
                    placeCentred(target, stamp, turned, item.rotation, 1);
                }
                break;
            }
            case "image": {
                const path = images.get(item.image);
                if (!path) throw bad();
                let image = embedded.get(item.image);
                if (!image) {
                    const png = await sharp(await readFile(path), { limitInputPixels: 40_000_000 })
                        .rotate()
                        .resize({ width: 3000, height: 3000, fit: "inside", withoutEnlargement: true })
                        .png()
                        .toBuffer()
                        .catch(() => {
                            throw new AppError("An image couldn't be read. Please use JPG, PNG or WebP.", 422, "INVALID_IMAGE");
                        });
                    image = await document.embedPng(png);
                    embedded.set(item.image, image);
                }
                placeCentred(target, imageStamp(image, item.width, item.height), { x: item.x + item.width / 2, y: item.y + item.height / 2 }, item.rotation, item.opacity);
                break;
            }
            case "ink":
                for (const stroke of item.strokes) {
                    if (stroke.length < 2) continue;
                    page.drawSvgPath(svgPath(target, stroke), { x: 0, y: 0, borderColor: toRgb(item.color), borderWidth: item.width, borderOpacity: item.opacity, borderLineCap: LineCapStyle.Round });
                }
                break;
            case "highlight":
            case "underline":
            case "strike":
                for (const rect of item.rects) {
                    const box =
                        item.kind === "highlight"
                            ? rect
                            : item.kind === "underline"
                              ? { x: rect.x, y: rect.y + rect.height * 0.9, width: rect.width, height: Math.max(0.75, rect.height * 0.07) }
                              : { x: rect.x, y: rect.y + rect.height * 0.52, width: rect.width, height: Math.max(0.75, rect.height * 0.07) };
                    // Highlights multiply, so the text under them stays dark.
                    page.drawRectangle({ ...pdfRect(target, box.x, box.y, box.width, box.height), color: toRgb(item.color), opacity: item.kind === "highlight" ? 0.45 : 1, ...(item.kind === "highlight" ? { blendMode: BlendMode.Multiply } : {}) });
                }
                break;
            case "rect":
                page.drawRectangle({ ...pdfRect(target, item.x, item.y, item.width, item.height), borderColor: toRgb(item.stroke), borderWidth: item.strokeWidth, borderOpacity: item.opacity, ...(item.fill ? { color: toRgb(item.fill), opacity: item.opacity } : {}) });
                break;
            case "ellipse": {
                const centre = toPdf(target, item.x + item.width / 2, item.y + item.height / 2);
                const sideways = target.rotation === 90 || target.rotation === 270;
                page.drawEllipse({ x: centre.x, y: centre.y, xScale: (sideways ? item.height : item.width) / 2, yScale: (sideways ? item.width : item.height) / 2, borderColor: toRgb(item.stroke), borderWidth: item.strokeWidth, borderOpacity: item.opacity, ...(item.fill ? { color: toRgb(item.fill), opacity: item.opacity } : {}) });
                break;
            }
            case "line":
            case "arrow": {
                const style = { thickness: item.strokeWidth, color: toRgb(item.stroke), opacity: item.opacity, lineCap: LineCapStyle.Round };
                page.drawLine({ start: toPdf(target, item.x1, item.y1), end: toPdf(target, item.x2, item.y2), ...style });
                if (item.kind === "arrow") {
                    // The head: two short strokes back from the tip, 28° either side.
                    const angle = Math.atan2(item.y2 - item.y1, item.x2 - item.x1);
                    const length = Math.max(8, item.strokeWidth * 4);
                    for (const side of [-1, 1]) {
                        const a = angle + Math.PI - side * (28 * Math.PI) / 180;
                        page.drawLine({ start: toPdf(target, item.x2, item.y2), end: toPdf(target, item.x2 + Math.cos(a) * length, item.y2 + Math.sin(a) * length), ...style });
                    }
                }
                break;
            }
        }
    }
    // Deleted pages go last, highest first (earlier indices stay valid).
    for (const number of [...new Set(deletePages)].sort((a, b) => b - a)) document.removePage(number - 1);
    context.progress("saving", annotations.length, annotations.length);
    const path = context.workspace.file("pdf");
    const pages = await savePdf(document, path);
    await context.addFile({ name: `${safeDocumentName(input.name)}-${purpose === "sign" ? "signed" : "edited"}.pdf`, mimeType: "application/pdf", path, pages });
    context.summary({ pages, edits: annotations.length });
}
