import { images } from "@/assets/images/landing";
import type { BackgroundSpec, TemplateId } from "./document";

/**
 * Background presets and the one function that draws any background. The canvas preview, the
 * thumbnails and the exported file all go through `drawBackground`, so what you pick is exactly
 * what you download.
 */

export const SOLID_PRESETS = [
    { key: "white", value: "#ffffff" },
    { key: "black", value: "#111114" },
    { key: "lightGrey", value: "#ececef" },
    { key: "blue", value: "#2563eb" },
    { key: "pink", value: "#f472b6" },
    { key: "green", value: "#16a34a" },
    { key: "purple", value: "#7c3aed" },
    { key: "beige", value: "#eadfcf" },
] as const;

export type SolidKey = (typeof SOLID_PRESETS)[number]["key"];

export const GRADIENT_PRESETS = [
    { id: "soft-blue", from: "#e0f2fe", to: "#a5c8f5", angle: 180, radial: false },
    { id: "lavender", from: "#f3e8ff", to: "#c4b5fd", angle: 180, radial: false },
    { id: "peach", from: "#fff1e6", to: "#fdb8a8", angle: 160, radial: false },
    { id: "ocean", from: "#38bdf8", to: "#1e3a8a", angle: 135, radial: false },
    { id: "sunset", from: "#fdba74", to: "#db2777", angle: 135, radial: false },
    { id: "professional-grey", from: "#fafafa", to: "#a1a1aa", angle: 0, radial: true },
    { id: "pastel-green", from: "#ecfdf5", to: "#a7f3d0", angle: 180, radial: false },
] as const;

export type GradientId = (typeof GRADIENT_PRESETS)[number]["id"];

/** Directions offered for a custom gradient, as CSS-style angles (0 = towards the top). */
export const GRADIENT_DIRECTIONS = [
    { id: "down", angle: 180, radial: false },
    { id: "right", angle: 90, radial: false },
    { id: "diagonal", angle: 135, radial: false },
    { id: "rising", angle: 45, radial: false },
    { id: "radial", angle: 0, radial: true },
] as const;

export type TemplateCategory = "studio" | "business" | "product" | "nature" | "social" | "minimal" | "abstract";
export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = ["studio", "business", "product", "nature", "social", "minimal", "abstract"];

/** Drawn templates: generated at the export's own resolution, so they're sharp at any size. */
export const DRAWN_TEMPLATES: readonly { id: TemplateId; category: TemplateCategory }[] = [
    { id: "studio-light", category: "studio" },
    { id: "studio-dark", category: "studio" },
    { id: "business-bokeh", category: "business" },
    { id: "business-slate", category: "business" },
    { id: "product-podium", category: "product" },
    { id: "product-mint", category: "product" },
    { id: "social-sunny", category: "social" },
    { id: "social-pop", category: "social" },
    { id: "minimal-horizon", category: "minimal" },
    { id: "minimal-arch", category: "minimal" },
    { id: "abstract-waves", category: "abstract" },
    { id: "abstract-blobs", category: "abstract" },
];

/** The bundled CC0 photographs (see assets/images/landing/CREDITS.md), offered as nature scenes. */
export const PHOTO_TEMPLATES = [
    { id: "scene-kingfisher", key: "kingfisher", url: images.kingfisher.src },
    { id: "scene-heron", key: "heron", url: images.heron.src },
    { id: "scene-flamingo", key: "flamingo", url: images.flamingo.src },
    { id: "scene-goose", key: "goose", url: images.goose.src },
] as const;

export const photoBackground = (id: string, url: string): BackgroundSpec => ({ kind: "image", id, url, zoom: 1, x: 0.5, y: 0.5 });

/** True when the background leaves the image see-through — only then can PNG/WebP keep alpha. */
export const isTransparent = (background: BackgroundSpec) => background.kind === "transparent";

// ------------------------------------------------------------------ drawing

type Ctx = CanvasRenderingContext2D;

/** Small deterministic PRNG, so a template looks the same in the thumbnail, the preview and the file. */
function seeded(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function linear(ctx: Ctx, width: number, height: number, angle: number, stops: readonly [number, string][]) {
    const radians = (angle * Math.PI) / 180;
    const dx = Math.sin(radians);
    const dy = -Math.cos(radians);
    // Half the length of the gradient line, as CSS defines it, so corners reach the end colours.
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    const cx = width / 2;
    const cy = height / 2;
    const gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
    for (const [offset, colour] of stops) gradient.addColorStop(offset, colour);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

function glow(ctx: Ctx, x: number, y: number, radius: number, colour: string, alpha = 1) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, colour);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
}

function vignette(ctx: Ctx, width: number, height: number, centre: string, edge: string, cy = 0.42) {
    const radius = Math.hypot(width, height) * 0.62;
    const gradient = ctx.createRadialGradient(width / 2, height * cy, 0, width / 2, height * cy, radius);
    gradient.addColorStop(0, centre);
    gradient.addColorStop(1, edge);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

/** A floor plane meeting a wall: a band below `horizon` with a soft contact shadow along the seam. */
function floor(ctx: Ctx, width: number, height: number, horizon: number, top: string, bottom: string) {
    const y = height * horizon;
    const gradient = ctx.createLinearGradient(0, y, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, y, width, height - y);
    const seam = ctx.createLinearGradient(0, y - height * 0.02, 0, y + height * 0.03);
    seam.addColorStop(0, "rgba(0,0,0,0)");
    seam.addColorStop(0.5, "rgba(0,0,0,0.06)");
    seam.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = seam;
    ctx.fillRect(0, y - height * 0.02, width, height * 0.05);
}

function podium(ctx: Ctx, width: number, height: number, top: string, side: string) {
    const unit = Math.min(width, height);
    const cx = width / 2;
    const rx = unit * 0.36;
    const ry = unit * 0.075;
    const topY = height * 0.8;
    const depth = unit * 0.1;
    // Contact shadow first, so the podium sits on the floor rather than floating over it.
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx, topY + depth + ry * 0.4, rx * 1.08, ry * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.ellipse(cx, topY + depth, rx, ry, 0, 0, Math.PI);
    ctx.lineTo(cx - rx, topY);
    ctx.ellipse(cx, topY, rx, ry, 0, Math.PI, 0, true);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawTemplate(ctx: Ctx, id: TemplateId, width: number, height: number) {
    const unit = Math.min(width, height);
    switch (id) {
        case "studio-light":
            vignette(ctx, width, height, "#ffffff", "#cfd4dc");
            floor(ctx, width, height, 0.74, "rgba(0,0,0,0.02)", "rgba(0,0,0,0.08)");
            return;
        case "studio-dark":
            vignette(ctx, width, height, "#4a4e58", "#111216");
            floor(ctx, width, height, 0.74, "rgba(0,0,0,0.05)", "rgba(0,0,0,0.3)");
            return;
        case "business-bokeh": {
            linear(ctx, width, height, 180, [
                [0, "#dfe7f0"],
                [1, "#b9c6d6"],
            ]);
            const random = seeded(7);
            for (let i = 0; i < 26; i++) {
                const hue = random() > 0.5 ? "rgba(255,255,255,0.9)" : "rgba(255,236,200,0.8)";
                glow(ctx, random() * width, random() * height * 0.75, unit * (0.04 + random() * 0.09), hue, 0.35 + random() * 0.4);
            }
            return;
        }
        case "business-slate":
            linear(ctx, width, height, 180, [
                [0, "#3b4758"],
                [1, "#1f2733"],
            ]);
            glow(ctx, width * 0.5, height * 0.35, unit * 0.7, "rgba(125,160,200,0.35)");
            return;
        case "product-podium":
            linear(ctx, width, height, 180, [
                [0, "#f6efe7"],
                [1, "#e7dacb"],
            ]);
            floor(ctx, width, height, 0.7, "#e2d3c1", "#d6c4ae");
            podium(ctx, width, height, "#fbf6f0", "#e9dccd");
            return;
        case "product-mint":
            linear(ctx, width, height, 180, [
                [0, "#eafaf3"],
                [1, "#cdeee0"],
            ]);
            floor(ctx, width, height, 0.7, "#c5e8d8", "#b3dcc9");
            podium(ctx, width, height, "#f4fdf9", "#d3eee2");
            return;
        case "social-sunny":
            ctx.fillStyle = "#ffe07a";
            ctx.fillRect(0, 0, width, height);
            ctx.fillStyle = "#ff9fb2";
            ctx.beginPath();
            ctx.arc(width * 0.82, height * 0.2, unit * 0.34, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(width * 0.12, height * 0.9, unit * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            return;
        case "social-pop": {
            ctx.fillStyle = "#c7b8ff";
            ctx.fillRect(0, 0, width, height);
            const random = seeded(21);
            const palette = ["#ff8fc7", "#7ad7ff", "#ffe36e", "#ffffff"];
            for (let i = 0; i < 9; i++) glow(ctx, random() * width, random() * height, unit * (0.18 + random() * 0.22), palette[i % palette.length]!, 0.65);
            return;
        }
        case "minimal-horizon":
            ctx.fillStyle = "#efe9e1";
            ctx.fillRect(0, 0, width, height);
            floor(ctx, width, height, 0.66, "#e3d9cc", "#d9cdbd");
            return;
        case "minimal-arch": {
            ctx.fillStyle = "#e9e2d8";
            ctx.fillRect(0, 0, width, height);
            const archWidth = unit * 0.62;
            const left = (width - archWidth) / 2;
            const top = height * 0.14;
            ctx.fillStyle = "#ddd2c4";
            ctx.beginPath();
            ctx.moveTo(left, height);
            ctx.lineTo(left, top + archWidth / 2);
            ctx.arc(width / 2, top + archWidth / 2, archWidth / 2, Math.PI, 0);
            ctx.lineTo(left + archWidth, height);
            ctx.closePath();
            ctx.fill();
            floor(ctx, width, height, 0.82, "#d6cab9", "#cbbda9");
            return;
        }
        case "abstract-waves": {
            linear(ctx, width, height, 180, [
                [0, "#e0f2fe"],
                [1, "#bae6fd"],
            ]);
            const bands = ["rgba(56,189,248,0.35)", "rgba(14,116,144,0.3)", "rgba(30,64,175,0.35)"];
            bands.forEach((colour, index) => {
                const base = height * (0.55 + index * 0.14);
                const amplitude = unit * (0.06 + index * 0.015);
                ctx.fillStyle = colour;
                ctx.beginPath();
                ctx.moveTo(0, base);
                ctx.bezierCurveTo(width * 0.3, base - amplitude * 2, width * 0.6, base + amplitude * 2, width, base - amplitude);
                ctx.lineTo(width, height);
                ctx.lineTo(0, height);
                ctx.closePath();
                ctx.fill();
            });
            return;
        }
        case "abstract-blobs": {
            ctx.fillStyle = "#fbf4ee";
            ctx.fillRect(0, 0, width, height);
            glow(ctx, width * 0.18, height * 0.22, unit * 0.62, "rgba(253,164,175,0.75)");
            glow(ctx, width * 0.85, height * 0.3, unit * 0.58, "rgba(196,181,253,0.75)");
            glow(ctx, width * 0.55, height * 0.95, unit * 0.66, "rgba(125,211,252,0.7)");
            return;
        }
    }
}

function drawPhoto(ctx: Ctx, photo: CanvasImageSource & { width: number; height: number }, spec: Extract<BackgroundSpec, { kind: "image" }>, width: number, height: number) {
    // Cover the frame, then zoom in further if asked; x/y pick which part of the overflow stays in view.
    const scale = Math.max(width / photo.width, height / photo.height) * spec.zoom;
    const drawWidth = photo.width * scale;
    const drawHeight = photo.height * scale;
    ctx.drawImage(photo, -(drawWidth - width) * spec.x, -(drawHeight - height) * spec.y, drawWidth, drawHeight);
}

/**
 * Paints `background` over the whole of a `width` × `height` context. A photo background needs its
 * decoded bitmap; while that's still loading the area is left empty rather than guessed.
 */
export function drawBackground(ctx: Ctx, background: BackgroundSpec, width: number, height: number, photo?: ImageBitmap | null) {
    ctx.save();
    ctx.imageSmoothingQuality = "high";
    switch (background.kind) {
        case "transparent":
            break;
        case "colour":
            ctx.fillStyle = background.value;
            ctx.fillRect(0, 0, width, height);
            break;
        case "gradient":
            if (background.radial) {
                vignette(ctx, width, height, background.from, background.to, 0.5);
            } else {
                linear(ctx, width, height, background.angle, [
                    [0, background.from],
                    [1, background.to],
                ]);
            }
            break;
        case "template":
            drawTemplate(ctx, background.id, width, height);
            break;
        case "image":
            if (photo) drawPhoto(ctx, photo, background, width, height);
            break;
    }
    ctx.restore();
}
