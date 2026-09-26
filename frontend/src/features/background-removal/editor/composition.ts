import { type ExportFormat, formatOf } from "@/features/image-processing/exportFormat";
import { drawBackground } from "./backgrounds";
import type { EditorDoc } from "./document";

/**
 * Draws the finished image — background, then the subject where it was placed — into a
 * `targetWidth` × `targetHeight` context. The same function makes the export preview and the file.
 */
export function drawComposition(
    ctx: CanvasRenderingContext2D,
    doc: EditorDoc,
    subject: HTMLCanvasElement,
    photo: ImageBitmap | null,
    targetWidth: number,
    targetHeight: number,
    opaque: boolean,
) {
    const k = targetWidth / subject.width;
    ctx.save();
    ctx.imageSmoothingQuality = "high";
    // A format without alpha still needs something behind a see-through area; white, not canvas black.
    if (opaque) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);
    }
    drawBackground(ctx, doc.background, targetWidth, targetHeight, photo);
    const { x, y, scale } = doc.placement;
    const width = subject.width * scale;
    const height = subject.height * scale;
    ctx.drawImage(subject, ((subject.width - width) / 2 + x) * k, ((subject.height - height) / 2 + y) * k, width * k, height * k);
    ctx.restore();
}

/** Encodes the composition at full resolution. Nothing leaves the device. */
export async function exportComposition(doc: EditorDoc, subject: HTMLCanvasElement, photo: ImageBitmap | null, format: ExportFormat, quality: number): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = subject.width;
    canvas.height = subject.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");
    const { mimeType, alpha } = formatOf(format);
    drawComposition(ctx, doc, subject, photo, canvas.width, canvas.height, !alpha);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, mimeType === "image/png" ? undefined : quality));
    // Free the pixels now rather than whenever the collector gets to them.
    canvas.width = canvas.height = 0;
    if (!blob) throw new Error("encode-failed");
    return blob;
}
