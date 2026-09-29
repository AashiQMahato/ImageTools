import sharp, { type Sharp } from "sharp";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import type { Box } from "./types.js";

/** Text needs pixels: below this short side, the working copy is enlarged (at most 2.5×). */
const MIN_SHORT_SIDE = 1100;
/** And above this long side it's reduced, which reads just as well and much faster. */
const MAX_LONG_SIDE = 3000;
/**
 * Contrast is stretched only when text and paper are genuinely close: the darkest and lightest 1% of
 * pixels less than this apart (faded scans, grey photos of paper). A clean page is mostly paper, so
 * its overall spread is always small — that says nothing about its contrast.
 */
const LOW_CONTRAST = 110;

/** Luminance of the darkest and lightest 1% of pixels, from a small copy. */
async function tonalRange(image: Sharp) {
    const { data } = await image.clone().resize(400, 400, { fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const histogram = new Array<number>(256).fill(0);
    for (const value of data) histogram[value]!++;
    const at = (share: number) => {
        let seen = 0;
        for (let value = 0; value < 256; value++) {
            seen += histogram[value]!;
            if (seen >= data.length * share) return value;
        }
        return 255;
    };
    return at(0.99) - at(0.01);
}

export interface PreparedPage {
    /** What the OCR engine reads (PNG). */
    ocr: Buffer;
    /** The same pixels without enhancement, for measuring colour (raw RGB). */
    colour: { data: Buffer; width: number; height: number };
    /** Working pixels per original pixel. */
    scale: number;
    /** The selected region, in original pixels (null = the whole image). */
    region: Box | null;
    width: number;
    height: number;
    /** What was done, for the record. */
    steps: { enhancedContrast: boolean; resized: number };
}

export type Region = { type: "rect"; box: Box } | { type: "polygon"; points: [number, number][] };

function regionBox(region: Region, width: number, height: number): Box {
    const box =
        region.type === "rect"
            ? region.box
            : (() => {
                  const xs = region.points.map(([x]) => x);
                  const ys = region.points.map(([, y]) => y);
                  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
              })();
    const x = Math.max(0, Math.floor(box.x));
    const y = Math.max(0, Math.floor(box.y));
    const right = Math.min(width, Math.ceil(box.x + box.width));
    const bottom = Math.min(height, Math.ceil(box.y + box.height));
    if (right - x < 8 || bottom - y < 8) throw new AppError("The selected area is too small to read. Select a larger area.", 400, "INVALID_REGION");
    return { x, y, width: right - x, height: bottom - y };
}

/**
 * The OCR working copy. The original stays untouched: this is upright (already), cropped to the
 * chosen region (anything outside a free selection blanked to white), contrast-stretched only when
 * the page is actually flat, and resized only when too small (or needlessly large) to read well.
 */
export async function preparePage(upright: Buffer, size: { width: number; height: number }, region: Region | null): Promise<PreparedPage> {
    let image = sharp(upright, { limitInputPixels: env.maxImagePixels });
    let box: Box | null = null;
    let base = { width: size.width, height: size.height };
    if (region) {
        box = regionBox(region, size.width, size.height);
        const cropped = await image.extract({ left: box.x, top: box.y, width: box.width, height: box.height }).toBuffer();
        image = sharp(cropped);
        if (region.type === "polygon") {
            // Outside the drawn shape becomes white, so nothing there is read.
            const points = region.points.map(([x, y]) => `${(x - box!.x).toFixed(1)},${(y - box!.y).toFixed(1)}`).join(" ");
            const cover = Buffer.from(
                `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}"><path fill="white" fill-rule="evenodd" d="M0,0H${box.width}V${box.height}H0Z M${points.split(" ").join(" L")}Z"/></svg>`,
            );
            image = sharp(await image.composite([{ input: cover }]).toBuffer());
        }
        base = { width: box.width, height: box.height };
    }

    const short = Math.min(base.width, base.height);
    const long = Math.max(base.width, base.height);
    const scale = short < MIN_SHORT_SIDE ? Math.min(2.5, MIN_SHORT_SIDE / short) : long > MAX_LONG_SIDE ? MAX_LONG_SIDE / long : 1;
    const width = Math.max(1, Math.round(base.width * scale));
    const height = Math.max(1, Math.round(base.height * scale));
    const resized = scale === 1 ? image : image.resize(width, height, { fit: "fill", kernel: scale > 1 ? "lanczos3" : "lanczos2" });
    const colour = await resized.clone().flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

    let ocr = sharp(colour.data, { raw: colour.info });
    const enhancedContrast = (await tonalRange(ocr)) < LOW_CONTRAST;
    // No sharpening: measured, it made the recogniser drop Devanagari vowel signs.
    if (enhancedContrast) ocr = ocr.normalise({ lower: 1, upper: 99 });
    return {
        ocr: await ocr.png({ compressionLevel: 1 }).toBuffer(),
        colour: { data: colour.data, width: colour.info.width, height: colour.info.height },
        scale,
        region: box,
        width,
        height,
        steps: { enhancedContrast, resized: scale },
    };
}
