import type { ImageDimensions, UpscaleFactor } from "@/types/image";

/** The only factors the API accepts (see `UpscaleFactor` and POST /upscale). */
export const SCALES: readonly UpscaleFactor[] = [2, 4];

/** What a given scale would actually produce, so the choice is made against real numbers. */
export function targetSize(dimensions: ImageDimensions, scale: UpscaleFactor): ImageDimensions {
    return { width: dimensions.width * scale, height: dimensions.height * scale };
}

export function megapixels({ width, height }: ImageDimensions): string {
    return ((width * height) / 1_000_000).toFixed(1);
}
