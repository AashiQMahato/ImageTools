/** Formats the browser can encode a canvas to. JPG has no alpha, so it can't hold a cut-out. */
export type ExportFormat = "png" | "webp" | "jpeg";

export const FORMATS: readonly { id: ExportFormat; mimeType: string; extension: string; alpha: boolean }[] = [
    { id: "png", mimeType: "image/png", extension: "png", alpha: true },
    { id: "webp", mimeType: "image/webp", extension: "webp", alpha: true },
    { id: "jpeg", mimeType: "image/jpeg", extension: "jpg", alpha: false },
];

export const formatOf = (id: ExportFormat) => FORMATS.find((format) => format.id === id) ?? FORMATS[0]!;

/** The encoder's quality for the lossy formats. PNG ignores it. */
export const QUALITY = 0.92;

async function loadBitmap(url: string): Promise<ImageBitmap> {
    return createImageBitmap(await (await fetch(url)).blob());
}

/**
 * Re-encodes an image to another format at its own resolution — no resampling, so this only ever
 * changes how the pixels are stored. A format without alpha gets white behind it first, because a
 * canvas with nothing behind it composites onto black.
 */
export async function encodeImage(url: string, format: ExportFormat): Promise<Blob> {
    const source = await loadBitmap(url);
    try {
        const canvas = document.createElement("canvas");
        canvas.width = source.width;
        canvas.height = source.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no-canvas");

        const { mimeType, alpha } = formatOf(format);
        if (!alpha) {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(source, 0, 0);

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, mimeType === "image/png" ? undefined : QUALITY));
        if (!blob) throw new Error("encode-failed");
        return blob;
    } finally {
        source.close();
    }
}
