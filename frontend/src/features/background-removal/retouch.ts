/** Erase takes pixels away; restore paints them back from the original photo. */
export type BrushMode = "erase" | "restore";

export interface Point {
    x: number;
    y: number;
}

/** A circular area on the cut-out, in source pixels — so it means the same thing at any stage size. */
export interface Selection {
    x: number;
    y: number;
    radius: number;
}

export interface Edit {
    mode: BrushMode;
    area: Selection;
}

/** Below this a drag reads as a tap, and the area falls back to a sensible default. */
export const MIN_RADIUS = 5;
export const TAP_RADIUS = 40;

/** Soft-edged disc: solid to 88% of the radius, then falling away so edges don't look cut with scissors. */
function discGradient(context: CanvasRenderingContext2D, area: Selection) {
    const gradient = context.createRadialGradient(area.x, area.y, area.radius * 0.88, area.x, area.y, area.radius);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    return gradient;
}

/**
 * Applies one edit to the working copy. Erasing punches a hole in the alpha channel; restoring cuts
 * the same soft disc out of the original photo and lays it back on top — so what comes back is the
 * real pixels, not a guess.
 */
export function applyEdit(context: CanvasRenderingContext2D, edit: Edit, original: CanvasImageSource | null) {
    const { area, mode } = edit;

    if (mode === "erase") {
        context.save();
        context.globalCompositeOperation = "destination-out";
        context.fillStyle = discGradient(context, area);
        context.beginPath();
        context.arc(area.x, area.y, area.radius, 0, Math.PI * 2);
        context.fill();
        context.restore();
        return;
    }

    if (!original) return;

    // Build the patch in a scratch canvas just big enough for the disc, so a large photo doesn't
    // cost a full-resolution clear per edit.
    const size = Math.max(2, Math.ceil(area.radius * 2));
    const left = Math.round(area.x - area.radius);
    const top = Math.round(area.y - area.radius);
    const scratch = document.createElement("canvas");
    scratch.width = size;
    scratch.height = size;
    const scratchContext = scratch.getContext("2d");
    if (!scratchContext) return;

    const local: Selection = { x: area.radius, y: area.radius, radius: area.radius };
    scratchContext.fillStyle = discGradient(scratchContext, local);
    scratchContext.beginPath();
    scratchContext.arc(local.x, local.y, local.radius, 0, Math.PI * 2);
    scratchContext.fill();
    // Keep only where the disc is, so the patch carries its soft edge.
    scratchContext.globalCompositeOperation = "source-in";
    scratchContext.drawImage(original, left, top, size, size, 0, 0, size, size);

    context.save();
    context.globalCompositeOperation = "source-over";
    context.drawImage(scratch, left, top);
    context.restore();
}

/** Rebuilds the cut-out from scratch: the model's output, then every edit still on the stack. */
export function replay(
    context: CanvasRenderingContext2D,
    cutout: CanvasImageSource,
    edits: readonly Edit[],
    original: CanvasImageSource | null,
    width: number,
    height: number,
) {
    context.save();
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, width, height);
    context.drawImage(cutout, 0, 0);
    context.restore();
    for (const edit of edits) applyEdit(context, edit, original);
}
