import { env } from "../../config/env.js";

export type SizeUnit = "mm" | "in";

/**
 * Every photo type is data, not code: the pipeline reads the physical size, resolution, background
 * and composition from here. A new type (visa, national ID, driving licence…) is a new entry.
 */
export interface PhotoPreset {
    id: string;
    name: string;
    /** The size as the requirement states it (e.g. 1.1 × 1.322 in, or 35 × 45 mm). */
    size: { width: number; height: number; unit: SizeUnit };
    /** The same size in millimetres, for every calculation. */
    widthMm: number;
    heightMm: number;
    dpi: number;
    background: string;
    composition: {
        /** Crown-to-chin height as a share of the photo's height (e.g. 35 × 45 mm: 32–36 mm → ~0.74). */
        headHeight: number;
        /** Space between the top of the photo and the top of the head, as a share of its height. */
        crownMargin: number;
        /** Acceptable range for headHeight when checking a (manually adjusted) result. */
        headHeightRange: [number, number];
    };
}

const ID_PHOTO: PhotoPreset["composition"] = { headHeight: 0.74, crownMargin: 0.09, headHeightRange: [0.66, 0.82] };

/** A size in its own unit, plus the millimetres everything is calculated in. */
const sized = (width: number, height: number, unit: SizeUnit) => ({
    size: { width, height, unit },
    widthMm: unit === "in" ? width * 25.4 : width,
    heightMm: unit === "in" ? height * 25.4 : height,
});

export const PHOTO_PRESETS: Record<string, PhotoPreset> = {
    passport: { id: "passport", name: "Passport Photo", ...sized(1.1, 1.322, "in"), dpi: env.photoGenerator.passportDpi, background: "#FFFFFF", composition: ID_PHOTO },
    mrp: { id: "mrp", name: "MRP Photo", ...sized(35, 45, "mm"), dpi: env.photoGenerator.mrpDpi, background: "#FFFFFF", composition: ID_PHOTO },
};

/** "1.1x1.322in", "35x45mm" — for file names. */
export const sizeLabel = (preset: PhotoPreset) => `${preset.size.width}x${preset.size.height}${preset.size.unit}`;

/** Physical size → pixels: pixels = millimetres / 25.4 × DPI. */
export const mmToPixels = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export function outputSize(preset: PhotoPreset) {
    return { width: mmToPixels(preset.widthMm, preset.dpi), height: mmToPixels(preset.heightMm, preset.dpi) };
}

export const aspectRatio = (preset: PhotoPreset) => preset.widthMm / preset.heightMm;

/** What the frontend shows for a preset. */
export function describePreset(preset: PhotoPreset) {
    const { width, height } = outputSize(preset);
    return { id: preset.id, name: preset.name, size: preset.size, widthMm: preset.widthMm, heightMm: preset.heightMm, dpi: preset.dpi, width, height, background: preset.background };
}

/** Paper for printable sheets. */
export const PAPER = {
    a4: { name: "A4", widthMm: 210, heightMm: 297, marginMm: 10, gapMm: 4 },
} as const;
