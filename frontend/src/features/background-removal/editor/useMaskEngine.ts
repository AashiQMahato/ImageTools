import { useCallback, useEffect, useRef, useState } from "react";
import type { BrushMode, Stroke } from "./document";

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Engine {
    width: number;
    height: number;
    /** The photo as uploaded. Restoring brings back exactly these pixels. */
    source: ImageBitmap;
    /** The model's output. Its alpha is the starting mask; it is never modified. */
    cutout: ImageBitmap;
    /** Current mask: the model's alpha plus every stroke. */
    mask: HTMLCanvasElement;
    /** What's shown and exported: the photo, cut out by the mask. */
    subject: HTMLCanvasElement;
    /** Scratch surfaces for the stroke in progress, created on first use. */
    before: HTMLCanvasElement | null;
    dabs: HTMLCanvasElement | null;
}

interface LiveStroke {
    stroke: Stroke;
    tip: HTMLCanvasElement;
    /** Everything this stroke has touched, so it can be redone in one pass. */
    bounds: Rect | null;
}

const canvas = (width: number, height: number) => {
    const element = document.createElement("canvas");
    element.width = width;
    element.height = height;
    return element;
};
const context = (element: HTMLCanvasElement) => element.getContext("2d")!;

async function decode(url: string, orientation?: ImageOrientation): Promise<ImageBitmap> {
    const blob = await (await fetch(url)).blob();
    return createImageBitmap(blob, orientation ? { imageOrientation: orientation } : undefined);
}

/** A round brush tip: solid in the middle, feathered over `softness` of its radius. */
function brushTip(size: number, softness: number) {
    const diameter = Math.max(1, Math.ceil(size));
    const tip = canvas(diameter, diameter);
    const ctx = context(tip);
    const radius = diameter / 2;
    if (softness <= 0.01) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const gradient = ctx.createRadialGradient(radius, radius, radius * (1 - softness), radius, radius, radius);
        gradient.addColorStop(0, "rgba(255,255,255,1)");
        gradient.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, diameter, diameter);
    }
    return tip;
}

const union = (a: Rect | null, b: Rect): Rect => {
    if (!a) return b;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

function clampRect(rect: Rect, width: number, height: number): Rect | null {
    const x = Math.max(0, Math.floor(rect.x));
    const y = Math.max(0, Math.floor(rect.y));
    const right = Math.min(width, Math.ceil(rect.x + rect.width));
    const bottom = Math.min(height, Math.ceil(rect.y + rect.height));
    return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

/** Stamps the tip along a segment, closely enough spaced that the stroke reads as continuous. */
function stamp(ctx: CanvasRenderingContext2D, tip: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number): Rect {
    const radius = tip.width / 2;
    const spacing = Math.max(0.75, tip.width * 0.12);
    const distance = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(distance / spacing));
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        ctx.drawImage(tip, x0 + (x1 - x0) * t - radius, y0 + (y1 - y0) * t - radius);
    }
    return { x: Math.min(x0, x1) - radius - 1, y: Math.min(y0, y1) - radius - 1, width: Math.abs(x1 - x0) + radius * 2 + 2, height: Math.abs(y1 - y0) + radius * 2 + 2 };
}

const clipTo = (ctx: CanvasRenderingContext2D, rect: Rect) => {
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();
};

/** mask(rect) = before(rect), then the stroke's dabs taken away (erase) or added (restore) at its opacity. */
function blend(engine: Engine, mode: BrushMode, opacity: number, rect: Rect) {
    const ctx = context(engine.mask);
    ctx.save();
    clipTo(ctx, rect);
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    ctx.drawImage(engine.before!, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    ctx.drawImage(engine.dabs!, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
}

/** subject(rect) = photo(rect) kept only where the mask is. Clipped, so the rest is left alone. */
function compose(engine: Engine, rect: Rect) {
    const ctx = context(engine.subject);
    ctx.save();
    clipTo(ctx, rect);
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    ctx.drawImage(engine.source, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(engine.mask, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
}

function ensureScratch(engine: Engine) {
    engine.before ??= canvas(engine.width, engine.height);
    engine.dabs ??= canvas(engine.width, engine.height);
}

/** Applies a whole, finished stroke to the mask (used when rebuilding for undo/redo). */
function applyStroke(engine: Engine, stroke: Stroke): Rect | null {
    ensureScratch(engine);
    const tip = brushTip(stroke.size, stroke.softness);
    const dabs = context(engine.dabs!);
    const { points } = stroke;
    let bounds: Rect | null = null;
    for (let i = 0; i < points.length; i += 2) {
        const x = points[i]!;
        const y = points[i + 1]!;
        const px = i >= 2 ? points[i - 2]! : x;
        const py = i >= 2 ? points[i - 1]! : y;
        bounds = union(bounds, stamp(dabs, tip, px, py, x, y));
    }
    const rect = bounds && clampRect(bounds, engine.width, engine.height);
    if (!rect) return null;
    const before = context(engine.before!);
    before.clearRect(rect.x, rect.y, rect.width, rect.height);
    before.drawImage(engine.mask, rect.x, rect.y, rect.width, rect.height, rect.x, rect.y, rect.width, rect.height);
    blend(engine, stroke.mode, stroke.opacity, rect);
    dabs.clearRect(rect.x, rect.y, rect.width, rect.height);
    return rect;
}

const sameList = (a: readonly Stroke[], b: readonly Stroke[]) => a.length === b.length && a.every((stroke, index) => stroke === b[index]);
const startsWith = (list: readonly Stroke[], prefix: readonly Stroke[]) => prefix.length <= list.length && prefix.every((stroke, index) => stroke === list[index]);

/**
 * Owns the cut-out as pixels. Non-destructive: the photo and the model's mask are kept untouched,
 * the current mask is rebuilt from them plus the stroke list, and only the region under the brush is
 * recomposited while painting — so a stroke on a 20-megapixel photo stays smooth.
 */
export function useMaskEngine(sourceUrl: string, cutoutUrl: string) {
    const engine = useRef<Engine | null>(null);
    const live = useRef<LiveStroke | null>(null);
    /** The strokes currently baked into the mask, by identity. */
    const applied = useRef<readonly Stroke[]>([]);
    const [state, setState] = useState<{ ready: boolean; error: boolean; width: number; height: number }>({ ready: false, error: false, width: 0, height: 0 });
    /** Bumped whenever the subject's pixels change, for anything that mirrors them. */
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const cutout = await decode(cutoutUrl);
            let source = await decode(sourceUrl);
            // The server cuts out the pixels as stored. If the browser rotated the photo for display
            // (EXIF orientation), read it unrotated too, so both line up pixel for pixel.
            if (source.width !== cutout.width || source.height !== cutout.height) {
                const raw = await decode(sourceUrl, "none");
                if (raw.width === cutout.width && raw.height === cutout.height) {
                    source.close();
                    source = raw;
                } else raw.close();
            }
            if (cancelled) {
                cutout.close();
                source.close();
                return;
            }
            const width = cutout.width;
            const height = cutout.height;
            const mask = canvas(width, height);
            context(mask).drawImage(cutout, 0, 0);
            const subject = canvas(width, height);
            subject.setAttribute("role", "img");
            const next: Engine = { width, height, source, cutout, mask, subject, before: null, dabs: null };
            // Scaled if the two ever disagree in size, rather than misaligned.
            if (source.width !== width || source.height !== height) {
                const scaled = await createImageBitmap(source, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
                source.close();
                next.source = scaled;
            }
            compose(next, { x: 0, y: 0, width, height });
            engine.current = next;
            applied.current = [];
            setState({ ready: true, error: false, width, height });
            setRevision((value) => value + 1);
        })().catch(() => {
            if (!cancelled) setState((current) => ({ ...current, error: true }));
        });
        return () => {
            cancelled = true;
            const current = engine.current;
            engine.current = null;
            current?.source.close();
            current?.cutout.close();
        };
    }, [sourceUrl, cutoutUrl]);

    /** Brings the mask in line with a stroke list — incrementally when it only grew, otherwise rebuilt. */
    const sync = useCallback((strokes: readonly Stroke[]) => {
        const current = engine.current;
        if (!current || sameList(strokes, applied.current)) return;
        const full = { x: 0, y: 0, width: current.width, height: current.height };
        if (startsWith(strokes, applied.current)) {
            let dirty: Rect | null = null;
            for (const stroke of strokes.slice(applied.current.length)) {
                const rect = applyStroke(current, stroke);
                if (rect) dirty = union(dirty, rect);
            }
            if (dirty) compose(current, dirty);
        } else {
            const mask = context(current.mask);
            mask.clearRect(0, 0, current.width, current.height);
            mask.drawImage(current.cutout, 0, 0);
            for (const stroke of strokes) applyStroke(current, stroke);
            compose(current, full);
        }
        applied.current = strokes;
        setRevision((value) => value + 1);
    }, []);

    const beginStroke = useCallback((settings: Omit<Stroke, "points">, x: number, y: number) => {
        const current = engine.current;
        if (!current) return;
        ensureScratch(current);
        // Snapshot the mask once per stroke; the stroke is always re-blended onto this, so overlapping
        // dabs within one stroke never build up past its opacity.
        const before = context(current.before!);
        before.clearRect(0, 0, current.width, current.height);
        before.drawImage(current.mask, 0, 0);
        live.current = { stroke: { ...settings, points: [x, y] }, tip: brushTip(settings.size, settings.softness), bounds: null };
        extend(current, live.current, x, y, x, y);
    }, []);

    const extendStroke = useCallback((x: number, y: number) => {
        const current = engine.current;
        const stroke = live.current;
        if (!current || !stroke) return;
        const { points } = stroke.stroke;
        const px = points[points.length - 2]!;
        const py = points[points.length - 1]!;
        if (Math.hypot(x - px, y - py) < 0.5) return;
        points.push(x, y);
        extend(current, stroke, px, py, x, y);
    }, []);

    /** Finishes the stroke. The returned stroke is already in the mask; add it to the document as-is. */
    const endStroke = useCallback((): Stroke | null => {
        const current = engine.current;
        const stroke = live.current;
        live.current = null;
        if (!current || !stroke) return null;
        if (stroke.bounds) {
            const rect = clampRect(stroke.bounds, current.width, current.height);
            if (rect) context(current.dabs!).clearRect(rect.x, rect.y, rect.width, rect.height);
        }
        const finished: Stroke = { ...stroke.stroke, points: [...stroke.stroke.points] };
        applied.current = [...applied.current, finished];
        setRevision((value) => value + 1);
        return finished;
    }, []);

    /** Drops an unfinished stroke (e.g. a second finger arrived), putting the mask back as it was. */
    const cancelStroke = useCallback(() => {
        const current = engine.current;
        const stroke = live.current;
        live.current = null;
        if (!current || !stroke?.bounds) return;
        const rect = clampRect(stroke.bounds, current.width, current.height);
        if (!rect) return;
        context(current.dabs!).clearRect(rect.x, rect.y, rect.width, rect.height);
        const mask = context(current.mask);
        mask.save();
        clipTo(mask, rect);
        mask.clearRect(rect.x, rect.y, rect.width, rect.height);
        mask.drawImage(current.before!, 0, 0);
        mask.restore();
        compose(current, rect);
    }, []);

    return {
        ...state,
        revision,
        /** The live subject canvas, for the stage to mount directly (no copying per frame). */
        subject: () => engine.current?.subject ?? null,
        sourceBitmap: () => engine.current?.source ?? null,
        sync,
        beginStroke,
        extendStroke,
        endStroke,
        cancelStroke,
    };
}

function extend(engine: Engine, stroke: LiveStroke, x0: number, y0: number, x1: number, y1: number) {
    const touched = stamp(context(engine.dabs!), stroke.tip, x0, y0, x1, y1);
    stroke.bounds = union(stroke.bounds, touched);
    const rect = clampRect(touched, engine.width, engine.height);
    if (!rect) return;
    blend(engine, stroke.stroke.mode, stroke.stroke.opacity, rect);
    compose(engine, rect);
}

export type MaskEngine = ReturnType<typeof useMaskEngine>;
