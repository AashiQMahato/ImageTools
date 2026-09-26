import type { ProcessingContext, RawImage, RawMask, RetouchOptions, RetouchProvider } from "../../../types/image.js";
import { AppError } from "../../../utils/AppError.js";
import { boxBlur, dilate, fromPlanes, gaussianBlur, luminance, normal, type Plane, pushPullFill, seededRandom, toPlanes, yieldToLoop } from "./pixels.js";

type Planes = [Plane, Plane, Plane];

interface Job {
    rgb: Planes;
    mask: Uint8Array;
    width: number;
    height: number;
    options: RetouchOptions;
    /** Yields to the event loop and stops if the client has gone. */
    step: () => Promise<void>;
}

/** Pixels the hole-filling modes treat as missing. */
const HOLE = 128;

/**
 * Remove: rebuild the hole from its surroundings, then give it the grain of the pixels around it so
 * it doesn't read as a smudge.
 */
async function remove({ rgb, mask, width, height, step }: Job): Promise<Planes> {
    const n = width * height;
    const known = new Float32Array(n);
    let knownCount = 0;
    for (let i = 0; i < n; i++) {
        known[i] = mask[i]! < HOLE ? 1 : 0;
        knownCount += known[i]!;
    }
    if (knownCount === 0) return rgb;

    const filled = rgb.map((plane) => plane.slice()) as Planes;
    pushPullFill(filled, known, width, height);
    await step();

    // How grainy is the neighbourhood? Measured on a ring of known pixels around the hole.
    const lum = luminance(rgb);
    const smooth = gaussianBlur(lum, width, height, 1.2);
    const ring = dilate(mask, width, height, Math.max(4, Math.round(Math.min(width, height) * 0.04)), HOLE);
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
        if (!ring[i] || !known[i]) continue;
        const detail = lum[i]! - smooth[i]!;
        sum += detail;
        sumSq += detail * detail;
        count++;
    }
    const sigma = count > 16 ? Math.sqrt(Math.max(0, sumSq / count - (sum / count) ** 2)) : 0;
    if (sigma < 0.5) return filled;
    await step();

    const random = seededRandom(width * 73_856_093 ^ height * 19_349_663);
    const noise = new Float32Array(n);
    for (let i = 0; i < n; i++) if (!known[i]) noise[i] = normal(random);
    // A touch of blur turns per-pixel noise into grain; it also lowers its spread, which the gain restores.
    const grain = gaussianBlur(noise, width, height, 0.6);
    const gain = sigma * 1.6;
    for (let i = 0; i < n; i++) {
        if (known[i]) continue;
        const g = grain[i]! * gain;
        filled[0][i]! += g;
        filled[1][i]! += g;
        filled[2][i]! += g;
    }
    return filled;
}

/**
 * Repair: take the colour and light from the surroundings but keep the area's own fine texture, the
 * way a healing brush does — a blemish disappears, the pores around it stay.
 */
async function heal(job: Job): Promise<Planes> {
    const { rgb, mask, width, height, step } = job;
    const n = width * height;
    const known = new Float32Array(n);
    let knownCount = 0;
    for (let i = 0; i < n; i++) {
        known[i] = mask[i]! < HOLE ? 1 : 0;
        knownCount += known[i]!;
    }
    if (knownCount === 0) return rgb;

    const filled = rgb.map((plane) => plane.slice()) as Planes;
    pushPullFill(filled, known, width, height);
    await step();

    const sigma = Math.max(1.5, Math.min(width, height) / 300);
    const out: Plane[] = [];
    for (let c = 0; c < 3; c++) {
        const base = gaussianBlur(filled[c]!, width, height, sigma);
        const own = gaussianBlur(rgb[c]!, width, height, sigma);
        const plane = new Float32Array(n);
        for (let i = 0; i < n; i++) plane[i] = base[i]! + (rgb[c]![i]! - own[i]!) * 0.75;
        out.push(plane);
        await step();
    }
    return out as Planes;
}

/** Edge-preserving smoothing (a self-guided filter): flat areas even out, edges stay put. */
function guided(p: Plane, width: number, height: number, radius: number, eps: number): Plane {
    const n = p.length;
    const squared = new Float32Array(n);
    for (let i = 0; i < n; i++) squared[i] = p[i]! * p[i]!;
    const mean = boxBlur(p, width, height, radius);
    const meanSq = boxBlur(squared, width, height, radius);
    const a = new Float32Array(n);
    const b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const variance = Math.max(0, meanSq[i]! - mean[i]! * mean[i]!);
        a[i] = variance / (variance + eps);
        b[i] = mean[i]! - a[i]! * mean[i]!;
    }
    const meanA = boxBlur(a, width, height, radius);
    const meanB = boxBlur(b, width, height, radius);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = meanA[i]! * p[i]! + meanB[i]!;
    return out;
}

/**
 * Smooth skin: even out blotches and shine while keeping edges (eyes, lips, hairline) sharp. The
 * finest detail — pores — is added back by `texture`, and the blend never goes all the way, so skin
 * never turns to plastic.
 */
async function smooth({ rgb, width, height, options, step }: Job): Promise<Planes> {
    const n = width * height;
    const { strength, texture } = options;
    const radius = Math.max(2, Math.round((Math.min(width, height) / 140) * (0.6 + strength)));
    const eps = (6 + 22 * strength) ** 2;
    const amount = 0.3 + 0.6 * strength;
    const out: Plane[] = [];
    for (let c = 0; c < 3; c++) {
        const p = rgb[c]!;
        const even = guided(p, width, height, radius, eps);
        const blurred = gaussianBlur(p, width, height, 1);
        const plane = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const fine = p[i]! - blurred[i]!;
            plane[i] = p[i]! + (even[i]! - p[i]!) * amount + fine * amount * texture;
        }
        out.push(plane);
        await step();
    }
    return out as Planes;
}

/** Enhance detail: fine sharpening plus a little local contrast, on brightness only (no colour fringes). */
async function enhance({ rgb, width, height, options, step }: Job): Promise<Planes> {
    const n = width * height;
    const { strength } = options;
    const lum = luminance(rgb);
    const fine = gaussianBlur(lum, width, height, 0.9);
    await step();
    const mid = gaussianBlur(lum, width, height, Math.max(2.5, Math.min(width, height) / 120));
    const limit = 48;
    const out = rgb.map((plane) => plane.slice()) as Planes;
    for (let i = 0; i < n; i++) {
        const delta = strength * (1.1 * (lum[i]! - fine[i]!) + 0.45 * (lum[i]! - mid[i]!));
        // Capped, so strong edges don't grow halos.
        const d = delta > limit ? limit : delta < -limit ? -limit : delta;
        out[0][i]! += d;
        out[1][i]! += d;
        out[2][i]! += d;
    }
    return out;
}

/**
 * Relight: bring the selected area toward a comfortable exposure, open up its shadows and ease its
 * highlights — then scale colour with brightness, so hues stay as they were.
 */
async function relight({ rgb, mask, width, height, options }: Job): Promise<Planes> {
    const n = width * height;
    const s = options.strength;
    const lum = luminance(rgb);
    let weighted = 0;
    let total = 0;
    for (let i = 0; i < n; i++) {
        const m = mask[i]! / 255;
        weighted += (lum[i]! / 255) * m;
        total += m;
    }
    const mean = total > 0 ? weighted / total : 0.5;
    const gain = Math.min(1.6, Math.max(0.8, (0.5 / Math.max(mean, 0.05)) ** (0.45 * s)));

    const out = rgb.map((plane) => plane.slice()) as Planes;
    for (let i = 0; i < n; i++) {
        const before = lum[i]! / 255;
        let l = before * gain;
        l = l + s * (0.55 * l * (1 - l) ** 2) - s * (0.4 * l * l * Math.max(0, 1 - l));
        // Roll highlights off instead of clipping them.
        if (l > 0.85) l = 0.85 + (1 - Math.exp(-(l - 0.85) / 0.15)) * 0.15;
        const ratio = Math.min(3, l / Math.max(before, 1 / 255));
        out[0][i] = out[0][i]! * ratio;
        out[1][i] = out[1][i]! * ratio;
        out[2][i] = out[2][i]! * ratio;
    }
    return out;
}

const MODES = { remove, heal, smooth, enhance, relight } as const;

/**
 * The built-in engine: classical image processing, always available, no model or GPU needed. It does
 * Smooth, Enhance and Relight well; for Remove object and Repair on large or detailed areas, an AI
 * inpainting provider (see iopaintProvider) reconstructs far more convincingly.
 */
class LocalRetouchProvider implements RetouchProvider {
    readonly name = "built-in";

    isAvailable() {
        return true;
    }

    supports() {
        return true;
    }

    async retouch(image: RawImage, mask: RawMask, options: RetouchOptions, { signal }: ProcessingContext): Promise<RawImage> {
        const { width, height } = image;
        const step = async () => {
            await yieldToLoop();
            if (signal.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
        };
        const rgb = toPlanes(image.data, width * height);
        const out = await MODES[options.mode]({ rgb, mask: mask.data, width, height, options, step });
        return { data: fromPlanes(out, width * height), width, height };
    }
}

export const localRetouchProvider = new LocalRetouchProvider();
