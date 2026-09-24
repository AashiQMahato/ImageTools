import type { ImageDimensions } from "@/types/image";

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatDimensions({ width, height }: ImageDimensions): string {
    return `${width.toLocaleString("en-US")} × ${height.toLocaleString("en-US")}`;
}

/** "Holiday Photo.jpeg" → "Holiday Photo" */
export function baseName(fileName: string): string {
    return fileName.replace(/\.[^.]*$/, "") || "image";
}
