import { useCallback, useMemo, useRef, useState } from "react";
import { brushTip, clampRect, clipTo, type Rect, stamp, union } from "@/features/background-removal/editor/useMaskEngine";

/** Paint adds to the selection; erase takes it away. */
export type SelectionMode = "paint" | "erase";

/** One brush stroke, in image pixels, so it means the same thing at any zoom or mask resolution. */
export interface SelectionStroke {
    mode: SelectionMode;
    /** Diameter. */
    size: number;
    /** 0 = hard edge, 1 = fully feathered. */
    softness: number;
    /** 0–1, for the whole stroke — overlapping dabs within it don't build up past it. */
    opacity: number;
    /** Flat [x0, y0, x1, y1, …]. */
    points: number[];
}

/** What the selection covers, from a quick low-resolution look. Bounds are fractions of the image. */
export interface SelectionInfo {
    empty: boolean;
    coverage: number;
    bounds: { x: number; y: number; width: number; height: number } | null;
}

/**
 * Longest side of the mask. The selection is soft by nature, so it doesn't need every pixel of a
 * 40-megapixel photo — the server scales it to the image. This keeps painting fast and memory modest.
 */
const MAX_SIDE = 4096;
/** The overlay colour. Only its alpha is the selection; the exported mask is white. */
const TINT = "rgb(139 92 246)";

interface Surfaces {
    mask: HTMLCanvasElement;
    before: HTMLCanvasElement;
    dabs: HTMLCanvasElement;
}

interface LiveStroke {
    stroke: SelectionStroke;
    tip: HTMLCanvasElement;
    bounds: Rect | null;
}

const makeCanvas = (width: number, height: number) => {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    return element;
};
const ctx = (element: HTMLCanvasElement) => element.getContext("2d")!;

/** The shared brush tip, in the overlay colour. */
function tintedTip(size: number, softness: number) {
    const tip = brushTip(size, softness);
    const context = ctx(tip);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = TINT;
    context.fillRect(0, 0, tip.width, tip.height);
    return tip;
}

/** mask(rect) = before(rect) with the stroke's dabs added (paint) or taken away (erase) at its opacity. */
function blend(surfaces: Surfaces, mode: SelectionMode, opacity: number, rect: Rect) {
    const context = ctx(surfaces.mask);
    context.save();
    clipTo(context, rect);
    context.clearRect(rect.x, rect.y, rect.width, rect.height);
    context.drawImage(surfaces.before, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    context.globalAlpha = opacity;
    context.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    context.drawImage(surfaces.dabs, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    context.restore();
}

const sameList = (a: readonly SelectionStroke[], b: readonly SelectionStroke[]) => a.length === b.length && a.every((stroke, index) => stroke === b[index]);
const startsWith = (list: readonly SelectionStroke[], prefix: readonly SelectionStroke[]) => prefix.length <= list.length && prefix.every((stroke, index) => stroke === list[index]);

/**
 * The retouch selection as pixels. Like the background editor's mask it is non-destructive: the mask is
 * rebuilt from the stroke list (incrementally when strokes were only added), the image is never
 * touched, and while painting only the region under the brush is redrawn.
 */
export function useSelectionMask(imageWidth: number, imageHeight: number) {
    const scale = Math.min(1, MAX_SIDE / Math.max(imageWidth, imageHeight, 1));
    const width = Math.max(1, Math.round(imageWidth * scale));
    const height = Math.max(1, Math.round(imageHeight * scale));

    const surfaces = useMemo<Surfaces>(() => {
        const mask = makeCanvas(width, height);
        mask.setAttribute("aria-hidden", "true");
        mask.className = "absolute inset-0 size-full";
        return { mask, before: makeCanvas(width, height), dabs: makeCanvas(width, height) };
    }, [width, height]);
    const live = useRef<LiveStroke | null>(null);
    const applied = useRef<readonly SelectionStroke[]>([]);
    /** Bumped whenever the mask's pixels change, for anything that mirrors them. */
    const [revision, setRevision] = useState(0);

    const toMask = useCallback((stroke: SelectionStroke): SelectionStroke => ({ ...stroke, size: Math.max(1, stroke.size * scale), points: stroke.points.map((value) => value * scale) }), [scale]);

    /** Applies a whole, finished stroke (used when rebuilding for undo/redo). */
    const applyStroke = useCallback(
        (stroke: SelectionStroke): Rect | null => {
            const { size, softness, opacity, mode, points } = toMask(stroke);
            const tip = tintedTip(size, softness);
            const dabs = ctx(surfaces.dabs);
            let bounds: Rect | null = null;
            for (let i = 0; i < points.length; i += 2) {
                const x = points[i]!;
                const y = points[i + 1]!;
                bounds = union(bounds, stamp(dabs, tip, i >= 2 ? points[i - 2]! : x, i >= 2 ? points[i - 1]! : y, x, y));
            }
            const rect = bounds && clampRect(bounds, width, height);
            if (!rect) return null;
            const before = ctx(surfaces.before);
            before.clearRect(rect.x, rect.y, rect.width, rect.height);
            before.drawImage(surfaces.mask, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
            blend(surfaces, mode, opacity, rect);
            dabs.clearRect(rect.x, rect.y, rect.width, rect.height);
            return rect;
        },
        [surfaces, toMask, width, height],
    );

    /** Brings the mask in line with a stroke list — incrementally when it only grew, otherwise rebuilt. */
    const sync = useCallback(
        (strokes: readonly SelectionStroke[]) => {
            if (sameList(strokes, applied.current)) return;
            if (startsWith(strokes, applied.current)) {
                for (const stroke of strokes.slice(applied.current.length)) applyStroke(stroke);
            } else {
                ctx(surfaces.mask).clearRect(0, 0, width, height);
                for (const stroke of strokes) applyStroke(stroke);
            }
            applied.current = strokes;
            setRevision((value) => value + 1);
        },
        [applyStroke, surfaces, width, height],
    );

    const extend = useCallback(
        (stroke: LiveStroke, x0: number, y0: number, x1: number, y1: number) => {
            const touched = stamp(ctx(surfaces.dabs), stroke.tip, x0, y0, x1, y1);
            stroke.bounds = union(stroke.bounds, touched);
            const rect = clampRect(touched, width, height);
            if (rect) blend(surfaces, stroke.stroke.mode, stroke.stroke.opacity, rect);
        },
        [surfaces, width, height],
    );

    /** Starts a stroke at an image-pixel point. */
    const beginStroke = useCallback(
        (settings: Omit<SelectionStroke, "points">, x: number, y: number) => {
            // Snapshot the mask once per stroke; the stroke is always re-blended onto this, so overlapping
            // dabs within one stroke never build up past its opacity.
            const before = ctx(surfaces.before);
            before.clearRect(0, 0, width, height);
            before.drawImage(surfaces.mask, 0, 0);
            live.current = { stroke: { ...settings, points: [x, y] }, tip: tintedTip(Math.max(1, settings.size * scale), settings.softness), bounds: null };
            extend(live.current, x * scale, y * scale, x * scale, y * scale);
        },
        [surfaces, width, height, scale, extend],
    );

    const extendStroke = useCallback(
        (x: number, y: number) => {
            const stroke = live.current;
            if (!stroke) return;
            const { points } = stroke.stroke;
            const px = points[points.length - 2]!;
            const py = points[points.length - 1]!;
            if (Math.hypot(x - px, y - py) * scale < 0.5) return;
            points.push(x, y);
            extend(stroke, px * scale, py * scale, x * scale, y * scale);
        },
        [scale, extend],
    );

    /** Finishes the stroke. The returned stroke is already in the mask; add it to the history as-is. */
    const endStroke = useCallback((): SelectionStroke | null => {
        const stroke = live.current;
        live.current = null;
        if (!stroke) return null;
        const rect = stroke.bounds && clampRect(stroke.bounds, width, height);
        if (rect) ctx(surfaces.dabs).clearRect(rect.x, rect.y, rect.width, rect.height);
        const finished: SelectionStroke = { ...stroke.stroke, points: [...stroke.stroke.points] };
        applied.current = [...applied.current, finished];
        setRevision((value) => value + 1);
        return finished;
    }, [surfaces, width, height]);

    /** Drops an unfinished stroke (e.g. a second finger arrived), putting the mask back as it was. */
    const cancelStroke = useCallback(() => {
        const stroke = live.current;
        live.current = null;
        const rect = stroke?.bounds && clampRect(stroke.bounds, width, height);
        if (!rect) return;
        ctx(surfaces.dabs).clearRect(rect.x, rect.y, rect.width, rect.height);
        const mask = ctx(surfaces.mask);
        mask.save();
        clipTo(mask, rect);
        mask.clearRect(rect.x, rect.y, rect.width, rect.height);
        mask.drawImage(surfaces.before, 0, 0);
        mask.restore();
    }, [surfaces, width, height]);

    /** A quick look at a 256-px copy: is anything selected, how much, and where. */
    const inspect = useCallback((): SelectionInfo => {
        const k = Math.min(1, 256 / Math.max(width, height));
        const w = Math.max(1, Math.round(width * k));
        const h = Math.max(1, Math.round(height * k));
        const probe = makeCanvas(w, h);
        const context = probe.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(surfaces.mask, 0, 0, w, h);
        const { data } = context.getImageData(0, 0, w, h);
        let left = w;
        let top = h;
        let right = -1;
        let bottom = -1;
        let total = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const alpha = data[(y * w + x) * 4 + 3]!;
                if (alpha <= 8) continue;
                total += alpha / 255;
                left = Math.min(left, x);
                right = Math.max(right, x);
                top = Math.min(top, y);
                bottom = y;
            }
        }
        if (right < 0) return { empty: true, coverage: 0, bounds: null };
        return { empty: false, coverage: total / (w * h), bounds: { x: left / w, y: top / h, width: (right - left + 1) / w, height: (bottom - top + 1) / h } };
    }, [surfaces, width, height]);

    /** The selection as a PNG: white where selected (alpha = how much), transparent everywhere else. */
    const exportPng = useCallback(async (): Promise<Blob> => {
        const out = makeCanvas(width, height);
        const context = ctx(out);
        context.fillStyle = "#fff";
        context.fillRect(0, 0, width, height);
        context.globalCompositeOperation = "destination-in";
        context.drawImage(surfaces.mask, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
        out.width = out.height = 0;
        if (!blob) throw new Error("mask-export-failed");
        return blob;
    }, [surfaces, width, height]);

    return {
        /** The live mask canvas, for the canvas to mount directly (never copied per frame). */
        canvas: surfaces.mask,
        revision,
        sync,
        beginStroke,
        extendStroke,
        endStroke,
        cancelStroke,
        inspect,
        exportPng,
    };
}

export type SelectionMask = ReturnType<typeof useSelectionMask>;
