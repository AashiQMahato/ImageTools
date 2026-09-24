/**
 * Colour adjustments as one 3×4 affine colour matrix (rows R, G, B; columns r, g, b, offset in 0–255 units).
 * The same matrix drives the live preview and the export, so what you see is what you download.
 */

export interface Adjustments {
    exposure: number;
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    tint: number;
}

export type AdjustmentKey = keyof Adjustments;

export const NEUTRAL_ADJUSTMENTS: Adjustments = { exposure: 0, brightness: 0, contrast: 0, saturation: 0, warmth: 0, tint: 0 };

export const ADJUSTMENT_GROUPS: ReadonlyArray<{ title: "light" | "colour"; items: ReadonlyArray<{ key: AdjustmentKey }> }> = [
    {
        title: "light",
        items: [
            { key: "exposure" },
            { key: "brightness" },
            { key: "contrast" },
        ],
    },
    {
        title: "colour",
        items: [
            { key: "saturation" },
            { key: "warmth" },
            { key: "tint" },
        ],
    },
];

export type FilterId = "original" | "vivid" | "warm" | "cool" | "dramatic" | "mono" | "silvertone" | "noir";

export const FILTERS: ReadonlyArray<{ id: FilterId; look: Partial<Adjustments> & { mono?: boolean } }> = [
    { id: "original", look: {} },
    { id: "vivid", look: { saturation: 35, contrast: 12 } },
    { id: "warm", look: { saturation: 22, contrast: 8, warmth: 45 } },
    { id: "cool", look: { saturation: 18, contrast: 8, warmth: -45 } },
    { id: "dramatic", look: { contrast: 38, saturation: -18, exposure: -12 } },
    { id: "mono", look: { mono: true, contrast: 6 } },
    { id: "silvertone", look: { mono: true, contrast: -14, brightness: 14, warmth: 12 } },
    { id: "noir", look: { mono: true, contrast: 55, exposure: -18 } },
];

type Matrix = number[]; // 12 numbers, row-major 3×4

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
const LUMA = [0.2126, 0.7152, 0.0722];

/** a ∘ b: apply b first, then a. */
function multiply(a: Matrix, b: Matrix): Matrix {
    const out = new Array(12).fill(0);
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
            let sum = 0;
            for (let k = 0; k < 3; k++) sum += (a[row * 4 + k] ?? 0) * (b[k * 4 + col] ?? 0);
            if (col === 3) sum += a[row * 4 + 3] ?? 0;
            out[row * 4 + col] = sum;
        }
    }
    return out;
}

const scale = (r: number, g: number, b: number): Matrix => [r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0];

function saturationMatrix(amount: number): Matrix {
    const [lr, lg, lb] = LUMA as [number, number, number];
    const s = amount;
    return [
        lr + (1 - lr) * s, lg * (1 - s), lb * (1 - s), 0,
        lr * (1 - s), lg + (1 - lg) * s, lb * (1 - s), 0,
        lr * (1 - s), lg * (1 - s), lb + (1 - lb) * s, 0,
    ];
}

function contrastMatrix(amount: number): Matrix {
    const offset = 128 * (1 - amount);
    return [amount, 0, 0, offset, 0, amount, 0, offset, 0, 0, amount, offset];
}

function adjustmentMatrix(adjustments: Partial<Adjustments>, mono = false): Matrix {
    const a = { ...NEUTRAL_ADJUSTMENTS, ...adjustments };
    let m = IDENTITY;
    if (mono) m = multiply(saturationMatrix(0), m);
    // ±100 = ±1 stop.
    if (a.exposure) m = multiply(scale(2 ** (a.exposure / 100), 2 ** (a.exposure / 100), 2 ** (a.exposure / 100)), m);
    // +100 = 1.6×, −100 = 0.5×.
    if (a.contrast) m = multiply(contrastMatrix(1 + a.contrast / (a.contrast > 0 ? 166 : 200)), m);
    if (a.brightness) {
        const lift = (a.brightness / 100) * 36;
        m = multiply([1, 0, 0, lift, 0, 1, 0, lift, 0, 0, 1, lift], m);
    }
    if (a.saturation) m = multiply(saturationMatrix(1 + a.saturation / 100), m);
    if (a.warmth) {
        const w = a.warmth / 100;
        m = multiply(scale(1 + 0.07 * w, 1 + 0.01 * w, 1 - 0.09 * w), m);
    }
    if (a.tint) {
        const t = a.tint / 100;
        m = multiply(scale(1 + 0.04 * t, 1 - 0.07 * t, 1 + 0.04 * t), m);
    }
    return m;
}

/** Filter look first, then the user's adjustments on top. */
export function buildMatrix(filter: FilterId, adjustments: Adjustments): Matrix | null {
    const look = FILTERS.find((f) => f.id === filter)?.look ?? {};
    const { mono, ...lookAdjustments } = look;
    const m = multiply(adjustmentMatrix(adjustments), adjustmentMatrix(lookAdjustments, mono));
    return m.every((value, index) => Math.abs(value - (IDENTITY[index] ?? 0)) < 1e-6) ? null : m;
}

/** Apply a colour matrix to pixels in place. Alpha is untouched. */
export function applyMatrix(data: Uint8ClampedArray, m: Matrix) {
    const [r0, r1, r2, r3, g0, g1, g2, g3, b0, b1, b2, b3] = m as [number, number, number, number, number, number, number, number, number, number, number, number];
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        data[i] = r0 * r + r1 * g + r2 * b + r3;
        data[i + 1] = g0 * r + g1 * g + g2 * b + g3;
        data[i + 2] = b0 * r + b1 * g + b2 * b + b3;
    }
}

export const isNeutral = (adjustments: Adjustments) => Object.values(adjustments).every((value) => value === 0);
