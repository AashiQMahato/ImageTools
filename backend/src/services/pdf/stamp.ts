import path from "node:path";
import { degrees, type PDFDocument, type PDFFont, type PDFImage, type PDFPage, rgb, StandardFonts } from "pdf-lib";
import sharp from "sharp";
import { BACKEND_ROOT } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

/**
 * Stamping text and images onto pages (watermarks, page numbers). Positions are given as the reader
 * sees the page — top left origin, y down, in points, the page's own rotation already applied — and
 * converted here to PDF space, so a stamp lands in the same place on portrait, landscape and rotated
 * pages alike.
 */

const DEVANAGARI_FONT = path.join(BACKEND_ROOT, "assets/fonts/NotoSansDevanagari.ttf");
/** Raster text is drawn at this many pixels per point: crisp in print, still small. */
const RASTER_SCALE = 4;

export interface VisualPage {
    page: PDFPage;
    /** Width and height as displayed. */
    width: number;
    height: number;
    rotation: 0 | 90 | 180 | 270;
    box: { x: number; y: number; width: number; height: number };
}

export function visualPage(page: PDFPage): VisualPage {
    const rotation = (((page.getRotation().angle % 360) + 360) % 360) as VisualPage["rotation"];
    // What's displayed is the crop box (the media box if there's none).
    const box = page.getCropBox();
    const sideways = rotation === 90 || rotation === 270;
    return { page, rotation, box, width: sideways ? box.height : box.width, height: sideways ? box.width : box.height };
}

/** A point as the reader sees it → the page's own coordinates. */
export function toPdf({ rotation, box }: VisualPage, vx: number, vy: number) {
    switch (rotation) {
        case 90:
            return { x: box.x + vy, y: box.y + vx };
        case 180:
            return { x: box.x + box.width - vx, y: box.y + vy };
        case 270:
            return { x: box.x + box.width - vy, y: box.y + box.height - vx };
        default:
            return { x: box.x + vx, y: box.y + box.height - vy };
    }
}

/** Offsets turned clockwise by `angle` degrees, in reader space (y down). */
const turn = (x: number, y: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return { x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) };
};

export interface Stamp {
    /** Width and height in points, before turning. */
    width: number;
    height: number;
    /** Where the drawn box's baseline-left corner sits relative to its top: text draws from its baseline, images from their bottom. */
    draw: (page: PDFPage, at: { x: number; y: number }, rotate: number, opacity: number) => void;
}

/**
 * Draws a stamp centred on a point the reader sees, turned clockwise by `angle` as the reader sees it.
 */
export function placeCentred(target: VisualPage, stamp: Stamp, centre: { x: number; y: number }, angle: number, opacity: number) {
    // The stamp's bottom-left corner (text: baseline start), relative to its centre, turned with it.
    const corner = turn(-stamp.width / 2, stamp.height / 2, angle);
    const at = toPdf(target, centre.x + corner.x, centre.y + corner.y);
    stamp.draw(target.page, at, target.rotation - angle, opacity);
}

export interface TextStyle {
    size: number;
    color: { r: number; g: number; b: number };
    bold?: boolean;
}

const hexColour = (value: string) => {
    const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
    if (!match) throw new AppError("That colour isn't valid.", 400, "INVALID_REQUEST");
    const number = Number.parseInt(match[1]!, 16);
    return { r: (number >> 16) / 255, g: ((number >> 8) & 255) / 255, b: (number & 255) / 255 };
};
export { hexColour };

const escapeMarkup = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * A text stamp. Text the standard PDF fonts can write (Latin) is real, vector text; anything else —
 * Nepali, for one — is shaped properly (conjuncts, vowel signs) by HarfBuzz with a bundled Noto font
 * and placed as a high-resolution image, because PDF's standard fonts can't write it at all.
 */
export async function textStamp(document: PDFDocument, text: string, style: TextStyle, fonts: Map<string, PDFFont>): Promise<Stamp> {
    const fontName = style.bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica;
    let font = fonts.get(fontName);
    if (!font) {
        font = await document.embedFont(fontName);
        fonts.set(fontName, font);
    }
    const encodable = (() => {
        try {
            font.encodeText(text);
            return true;
        } catch {
            return false;
        }
    })();
    const colour = rgb(style.color.r, style.color.g, style.color.b);
    if (encodable) {
        const width = font.widthOfTextAtSize(text, style.size);
        const cap = font.heightAtSize(style.size, { descender: false }) * 0.72;
        return {
            width,
            height: cap,
            draw: (page, at, rotate, opacity) => page.drawText(text, { x: at.x, y: at.y, size: style.size, font: font!, color: colour, opacity, rotate: degrees(rotate) }),
        };
    }
    const hex = `#${[style.color.r, style.color.g, style.color.b].map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0")).join("")}`;
    const png = await sharp({
        text: { text: `<span foreground="${hex}">${escapeMarkup(text)}</span>`, font: `Noto Sans Devanagari ${style.bold ? "Bold" : ""} ${style.size}`, fontfile: DEVANAGARI_FONT, rgba: true, dpi: 72 * RASTER_SCALE },
    })
        .png()
        .toBuffer({ resolveWithObject: true });
    const image = await document.embedPng(png.data);
    return imageStamp(image, png.info.width / RASTER_SCALE, png.info.height / RASTER_SCALE);
}

export function imageStamp(image: PDFImage, width: number, height: number): Stamp {
    return {
        width,
        height,
        draw: (page, at, rotate, opacity) => page.drawImage(image, { x: at.x, y: at.y, width, height, opacity, rotate: degrees(rotate) }),
    };
}
