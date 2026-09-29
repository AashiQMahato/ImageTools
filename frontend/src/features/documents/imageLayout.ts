/**
 * Where an image goes on its PDF page — the same arithmetic as the server's placeImage
 * (backend/src/services/pdf/imagesToPdfService.ts), so the preview is the result.
 */
export type PageSize = "a4" | "letter" | "legal" | "original" | "custom";

export interface ImagesToPdfOptions {
    size: PageSize;
    orientation: "auto" | "portrait" | "landscape";
    custom: { width: number; height: number };
    margin: number;
    fit: "contain" | "cover" | "original";
    quality: number;
    maxDpi: number | null;
}

export const DEFAULT_IMAGES_TO_PDF: ImagesToPdfOptions = { size: "a4", orientation: "auto", custom: { width: 210, height: 297 }, margin: 10, fit: "contain", quality: 85, maxDpi: 300 };

const SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] } as const;
const MM = 72 / 25.4;
const PX = 72 / 96;

export interface Placement {
    page: { width: number; height: number };
    box: { x: number; y: number; width: number; height: number };
    crop: boolean;
}

export function placeImage(image: { width: number; height: number }, options: ImagesToPdfOptions): Placement {
    const margin = Math.max(0, options.margin) * MM;
    const natural = { width: image.width * PX, height: image.height * PX };
    if (options.size === "original") {
        return { page: { width: natural.width + margin * 2, height: natural.height + margin * 2 }, box: { x: margin, y: margin, ...natural }, crop: false };
    }
    let [width, height]: number[] = options.size === "custom" ? [options.custom.width * MM, options.custom.height * MM] : [...SIZES[options.size]];
    const landscape = options.orientation === "landscape" || (options.orientation === "auto" && image.width > image.height);
    if (landscape !== width! > height!) [width, height] = [height, width];
    const area = { x: margin, y: margin, width: Math.max(1, width! - margin * 2), height: Math.max(1, height! - margin * 2) };
    if (options.fit === "cover") return { page: { width: width!, height: height! }, box: area, crop: true };
    const scale = options.fit === "original" ? Math.min(1, area.width / natural.width, area.height / natural.height) : Math.min(area.width / natural.width, area.height / natural.height);
    const drawn = { width: natural.width * scale, height: natural.height * scale };
    return { page: { width: width!, height: height! }, box: { x: area.x + (area.width - drawn.width) / 2, y: area.y + (area.height - drawn.height) / 2, ...drawn }, crop: false };
}
