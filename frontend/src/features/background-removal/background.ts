import { type ExportFormat, formatOf, QUALITY } from "@/features/image-processing/exportFormat";

/** What sits behind the cut-out subject. `transparent` is the model's own output, untouched. */
export type Background =
    | { kind: "transparent" }
    | { kind: "colour"; value: string }
    | { kind: "image"; url: string; id: string };

export const TRANSPARENT: Background = { kind: "transparent" };

/** True when the chosen format would silently throw away the transparency the tool just produced. */
export function losesTransparency(background: Background, format: ExportFormat): boolean {
    return background.kind === "transparent" && !formatOf(format).alpha;
}

/** Swatches offered alongside the custom colour picker. Keys are i18n lookups. */
export const SWATCHES = [
    { key: "white", value: "#ffffff" },
    { key: "grey", value: "#f2f2f5" },
    { key: "black", value: "#1d1d1f" },
    { key: "blue", value: "#0369a1" },
    { key: "teal", value: "#0f766e" },
    { key: "amber", value: "#b45309" },
    { key: "rose", value: "#d1215a" },
] as const;

async function loadBitmap(url: string): Promise<ImageBitmap> {
    const response = await fetch(url);
    return createImageBitmap(await response.blob());
}

/**
 * Draws the chosen background, then the cut-out on top, at the cut-out's own resolution — so
 * replacing a background never resamples the subject. All of it happens on this device; the
 * server only ever saw the original upload.
 *
 * Also the single place the export format is applied, so "transparent PNG" and "photo backdrop as
 * WebP" are the same code path rather than two.
 */
export async function composite(cutoutUrl: string, background: Background, format: ExportFormat): Promise<{ blob: Blob; mimeType: string }> {
    const cutout = await loadBitmap(cutoutUrl);
    try {
        const canvas = document.createElement("canvas");
        canvas.width = cutout.width;
        canvas.height = cutout.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no-canvas");
        context.imageSmoothingQuality = "high";

        // A format without alpha still needs something behind the subject; white beats canvas black.
        if (background.kind === "transparent" && !formatOf(format).alpha) {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
        }

        if (background.kind === "colour") {
            context.fillStyle = background.value;
            context.fillRect(0, 0, canvas.width, canvas.height);
        } else if (background.kind === "image") {
            const scene = await loadBitmap(background.url);
            try {
                // "Cover": fill the frame and crop the overflow rather than distort the scene.
                const scale = Math.max(canvas.width / scene.width, canvas.height / scene.height);
                const width = scene.width * scale;
                const height = scene.height * scale;
                context.drawImage(scene, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
            } finally {
                scene.close();
            }
        }

        context.drawImage(cutout, 0, 0);

        const { mimeType } = formatOf(format);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, mimeType === "image/png" ? undefined : QUALITY));
        if (!blob) throw new Error("encode-failed");
        return { blob, mimeType };
    } finally {
        cutout.close();
    }
}
