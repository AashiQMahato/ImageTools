import { type CropRect, largestWithAspect, orientedSize, rotateRectCCW, shrinkToFit } from "./geometry";
import type { EditState } from "./render";
import type { AspectId } from "./useEditStore";

export interface SourceSize {
    width: number;
    height: number;
}

export const ASPECTS: ReadonlyArray<{ id: AspectId; /** Ratio text; null = named (translated) option. */ label: string | null; ratio: number | null }> = [
    { id: "free", label: null, ratio: null },
    { id: "original", label: null, ratio: null },
    { id: "1:1", label: null, ratio: 1 },
    { id: "16:9", label: "16:9", ratio: 16 / 9 },
    { id: "4:3", label: "4:3", ratio: 4 / 3 },
    { id: "3:2", label: "3:2", ratio: 3 / 2 },
    { id: "5:4", label: "5:4", ratio: 5 / 4 },
];

/** The locked ratio (w/h) for an aspect choice, or null for freeform. */
export function aspectRatio(id: AspectId, portrait: boolean, edit: EditState, source: SourceSize): number | null {
    if (id === "free") return null;
    if (id === "original") {
        const size = orientedSize(source.width, source.height, edit.orientation.quarter);
        return size.width / size.height;
    }
    const ratio = ASPECTS.find((aspect) => aspect.id === id)?.ratio ?? null;
    if (!ratio || ratio === 1) return ratio;
    return portrait ? Math.min(ratio, 1 / ratio) : Math.max(ratio, 1 / ratio);
}

export function applyAspect(edit: EditState, source: SourceSize, ratio: number | null): EditState {
    if (!ratio) return edit;
    const { width, height } = orientedSize(source.width, source.height, edit.orientation.quarter);
    return { ...edit, crop: largestWithAspect(ratio, edit.crop, edit.orientation.angle, width, height), resize: null };
}

/** Turn 90° counter-clockwise on screen. With one mirror applied, the underlying turn runs the other way. */
export function rotateLeft(edit: EditState): EditState {
    const { orientation } = edit;
    const mirrored = orientation.flipX !== orientation.flipY;
    return {
        ...edit,
        orientation: { ...orientation, quarter: orientation.quarter + (mirrored ? -1 : 1) },
        crop: rotateRectCCW(edit.crop),
        resize: edit.resize ? { width: edit.resize.height, height: edit.resize.width } : null,
    };
}

/** Mirror on screen. Mirroring reverses the straighten angle and reflects the crop. */
export function flip(edit: EditState, axis: "x" | "y"): EditState {
    const { orientation, crop } = edit;
    return {
        ...edit,
        orientation: {
            ...orientation,
            angle: orientation.angle === 0 ? 0 : -orientation.angle,
            flipX: axis === "x" ? !orientation.flipX : orientation.flipX,
            flipY: axis === "y" ? !orientation.flipY : orientation.flipY,
        },
        crop: axis === "x" ? { ...crop, cx: -crop.cx } : { ...crop, cy: -crop.cy },
    };
}

/**
 * Straighten to `angle`, starting from the crop the gesture began with, so turning back toward level
 * restores the original crop instead of leaving it shrunk. The crop zooms in just enough to avoid empty corners.
 */
export function straighten(edit: EditState, source: SourceSize, angle: number, baseCrop: CropRect): EditState {
    const { width, height } = orientedSize(source.width, source.height, edit.orientation.quarter);
    return { ...edit, orientation: { ...edit.orientation, angle }, crop: shrinkToFit(baseCrop, angle, width, height), resize: null };
}
