// Landing page photography (CC0 — see CREDITS.md). Each image ships in two widths for srcset.
import flamingo1080 from "./flamingo-1080.webp";
import flamingo1920 from "./flamingo-1920.webp";
import goose1080 from "./goose-1080.webp";
import goose2400 from "./goose-2400.webp";
import gooseLowres from "./goose-lowres.webp";
import heronCutout1080 from "./heron-cutout-1080.webp";
import heronCutout1920 from "./heron-cutout-1920.webp";
import heron1080 from "./heron-1080.webp";
import heron1920 from "./heron-1920.webp";
import kingfisherCutout1080 from "./kingfisher-cutout-1080.webp";
import kingfisherCutout1920 from "./kingfisher-cutout-1920.webp";
import kingfisher1080 from "./kingfisher-1080.webp";
import kingfisher1920 from "./kingfisher-1920.webp";

export interface ResponsiveImage {
    src: string;
    srcSet: string;
    width: number;
    height: number;
}

const responsive = (small: string, large: string, largeWidth: number, width: number, height: number): ResponsiveImage => ({
    src: small,
    srcSet: `${small} 1080w, ${large} ${largeWidth}w`,
    width,
    height,
});

export const images = {
    kingfisher: responsive(kingfisher1080, kingfisher1920, 1920, 1920, 1200),
    kingfisherCutout: responsive(kingfisherCutout1080, kingfisherCutout1920, 1920, 1920, 1200),
    heron: responsive(heron1080, heron1920, 1920, 1920, 1280),
    heronCutout: responsive(heronCutout1080, heronCutout1920, 1920, 1920, 1280),
    goose: responsive(goose1080, goose2400, 2400, 2400, 1594),
    flamingo: responsive(flamingo1080, flamingo1920, 1920, 1920, 1275),
} as const;

/** Full-resolution goose for the upscaler's "after" loupe, and a 6× downsampled copy for "before". */
export const gooseDetail = { high: goose2400, low: gooseLowres, aspect: 2400 / 1594 } as const;
