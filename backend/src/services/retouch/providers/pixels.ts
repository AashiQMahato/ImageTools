/**
 * The few filters the built-in retouch engine needs, on planar float images (one Float32Array per
 * channel, 0–255). Every filter is O(pixels) whatever its radius, so a large selection costs the same
 * per pixel as a small one.
 */

export type Plane = Float32Array;

const clamp = (value: number, min: number, max: number) => (value < min ? min : value > max ? max : value);

export function toPlanes(rgb: Buffer, pixels: number): [Plane, Plane, Plane] {
    const planes: [Plane, Plane, Plane] = [new Float32Array(pixels), new Float32Array(pixels), new Float32Array(pixels)];
    for (let i = 0, o = 0; i < pixels; i++, o += 3) {
        planes[0][i] = rgb[o]!;
        planes[1][i] = rgb[o + 1]!;
        planes[2][i] = rgb[o + 2]!;
    }
    return planes;
}

export function fromPlanes(planes: readonly Plane[], pixels: number): Buffer {
    const rgb = Buffer.allocUnsafe(pixels * 3);
    for (let i = 0, o = 0; i < pixels; i++, o += 3) {
        rgb[o] = clamp(Math.round(planes[0]![i]!), 0, 255);
        rgb[o + 1] = clamp(Math.round(planes[1]![i]!), 0, 255);
        rgb[o + 2] = clamp(Math.round(planes[2]![i]!), 0, 255);
    }
    return rgb;
}

/** Rec. 709 luma, 0–255. */
export function luminance([r, g, b]: readonly Plane[]): Plane {
    const out = new Float32Array(r!.length);
    for (let i = 0; i < out.length; i++) out[i] = 0.2126 * r![i]! + 0.7152 * g![i]! + 0.0722 * b![i]!;
    return out;
}

/** Mean over a (2r+1)² square, edges clamped. Two running sums, so the radius is free. */
export function boxBlur(src: Plane, width: number, height: number, radius: number): Plane {
    const r = Math.max(0, Math.round(radius));
    if (r === 0) return src.slice();
    const temp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    const norm = 1 / (2 * r + 1);

    for (let y = 0; y < height; y++) {
        const row = y * width;
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += src[row + clamp(i, 0, width - 1)]!;
        for (let x = 0; x < width; x++) {
            temp[row + x] = sum * norm;
            sum += src[row + Math.min(width - 1, x + r + 1)]! - src[row + Math.max(0, x - r)]!;
        }
    }
    for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let i = -r; i <= r; i++) sum += temp[clamp(i, 0, height - 1) * width + x]!;
        for (let y = 0; y < height; y++) {
            out[y * width + x] = sum * norm;
            sum += temp[Math.min(height - 1, y + r + 1) * width + x]! - temp[Math.max(0, y - r) * width + x]!;
        }
    }
    return out;
}

/** Gaussian approximated by three box passes (variance r(r+1) for radius r). */
export function gaussianBlur(src: Plane, width: number, height: number, sigma: number): Plane {
    if (sigma < 0.3) return src.slice();
    const r = Math.max(1, Math.round((-1 + Math.sqrt(1 + 4 * sigma * sigma)) / 2));
    return boxBlur(boxBlur(boxBlur(src, width, height, r), width, height, r), width, height, r);
}

/** The selection as 0/1, grown by `radius` pixels (a square structuring element). */
export function dilate(mask: Uint8Array, width: number, height: number, radius: number, threshold = 128): Plane {
    const binary = new Float32Array(mask.length);
    for (let i = 0; i < mask.length; i++) binary[i] = mask[i]! >= threshold ? 1 : 0;
    if (radius < 1) return binary;
    const grown = boxBlur(binary, width, height, radius);
    for (let i = 0; i < grown.length; i++) grown[i] = grown[i]! > 1e-4 ? 1 : 0;
    return grown;
}

interface Level {
    planes: Plane[];
    weight: Plane;
    width: number;
    height: number;
}

/**
 * Push-pull inpainting: fills every pixel whose `known` weight is below 1 from its surroundings, in
 * place. The image is repeatedly halved, averaging only known pixels, until no holes remain; then each
 * level's gaps are filled from the smoother level above. The result is a seamless membrane that
 * follows the colours and light at the hole's edge.
 */
export function pushPullFill(planes: Plane[], known: Plane, width: number, height: number) {
    const levels: Level[] = [{ planes, weight: known, width, height }];
    let current = levels[0]!;
    while (current.width > 1 || current.height > 1) {
        const w = Math.ceil(current.width / 2);
        const h = Math.ceil(current.height / 2);
        const next: Level = { planes: current.planes.map(() => new Float32Array(w * h)), weight: new Float32Array(w * h), width: w, height: h };
        let holes = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const j = y * w + x;
                let total = 0;
                for (let dy = 0; dy < 2; dy++) {
                    const sy = 2 * y + dy;
                    if (sy >= current.height) continue;
                    for (let dx = 0; dx < 2; dx++) {
                        const sx = 2 * x + dx;
                        if (sx >= current.width) continue;
                        const i = sy * current.width + sx;
                        const weight = current.weight[i]!;
                        if (weight === 0) continue;
                        total += weight;
                        for (let c = 0; c < next.planes.length; c++) next.planes[c]![j]! += current.planes[c]![i]! * weight;
                    }
                }
                if (total > 0) for (let c = 0; c < next.planes.length; c++) next.planes[c]![j]! /= total;
                else holes = true;
                next.weight[j] = Math.min(1, total);
            }
        }
        levels.push(next);
        current = next;
        if (!holes) break;
    }

    for (let l = levels.length - 2; l >= 0; l--) {
        const fine = levels[l]!;
        const coarse = levels[l + 1]!;
        for (let y = 0; y < fine.height; y++) {
            const cy = clamp((y + 0.5) / 2 - 0.5, 0, coarse.height - 1);
            const y0 = Math.floor(cy);
            const y1 = Math.min(coarse.height - 1, y0 + 1);
            const fy = cy - y0;
            for (let x = 0; x < fine.width; x++) {
                const i = y * fine.width + x;
                const weight = fine.weight[i]!;
                if (weight >= 1) continue;
                const cx = clamp((x + 0.5) / 2 - 0.5, 0, coarse.width - 1);
                const x0 = Math.floor(cx);
                const x1 = Math.min(coarse.width - 1, x0 + 1);
                const fx = cx - x0;
                for (let c = 0; c < fine.planes.length; c++) {
                    const p = coarse.planes[c]!;
                    const top = p[y0 * coarse.width + x0]! * (1 - fx) + p[y0 * coarse.width + x1]! * fx;
                    const bottom = p[y1 * coarse.width + x0]! * (1 - fx) + p[y1 * coarse.width + x1]! * fx;
                    const up = top * (1 - fy) + bottom * fy;
                    fine.planes[c]![i] = fine.planes[c]![i]! * weight + up * (1 - weight);
                }
            }
        }
    }
}

/** A small, seeded PRNG (mulberry32), so the same request always gives the same grain. */
export function seededRandom(seed: number) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Standard normal sample (Box–Muller). */
export function normal(random: () => number) {
    return Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
}

/** Lets other requests run between the heavier passes. */
export const yieldToLoop = () => new Promise<void>((resolve) => setImmediate(resolve));
