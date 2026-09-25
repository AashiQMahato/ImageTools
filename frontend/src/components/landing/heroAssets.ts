// Hero imagery. Every file is local and CC0 — sources and licences in src/assets/hero/ASSETS.md.
import afterBackground1280 from "@/assets/hero/transformations/after-background-1280.webp";
import afterBackground640 from "@/assets/hero/transformations/after-background-640.webp";
import beforeBackground1280 from "@/assets/hero/transformations/before-background-1280.webp";
import beforeBackground640 from "@/assets/hero/transformations/before-background-640.webp";
import detailLowres from "@/assets/hero/transformations/detail-lowres.webp";
import detailSharp from "@/assets/hero/transformations/detail-sharp.webp";
import shoeCutout from "@/assets/hero/transformations/shoe-cutout.webp";
import blueberries from "@/assets/hero/images/blueberries.webp";
import cameraFlatlay from "@/assets/hero/images/camera-flatlay.webp";
import makeupKit from "@/assets/hero/images/makeup-kit.webp";
import watchDenim from "@/assets/hero/images/watch-denim.webp";

/**
 * The centre piece. `before` and `after` share one 4:3 frame, so the cut-out lines up with the
 * original pixel for pixel as the background is wiped away. The cut-out is real output from the
 * app's own rembg pipeline (BiRefNet), not a mock-up.
 */
export const central = {
    before: { src: beforeBackground1280, srcSet: `${beforeBackground640} 640w, ${beforeBackground1280} 1280w` },
    after: { src: afterBackground1280, srcSet: `${afterBackground640} 640w, ${afterBackground1280} 1280w` },
    /** Rendered width: the whole column on phones, about half the hero from tablets up. */
    sizes: "(min-width: 64rem) 34rem, (min-width: 48rem) 48vw, 92vw",
    /** The dial, sharp — and the same crop genuinely downsampled 4×, so nothing is faked. */
    detail: { sharp: detailSharp, lowres: detailLowres },
} as const;

/** A local clip for a card. None ship yet — see ASSETS.md for the slot and what to add. */
export interface HeroVideoSource {
    src: string;
    type: "video/mp4" | "video/webm";
}

export type FloatMotion = "float-y" | "float-x" | "tilt" | "breathe" | "drift";

export type CardLabel = "backgroundRemoved" | "upscaled" | "cropped" | "edited";

export interface HeroCard {
    id: string;
    src: string;
    /** Empty: the cards illustrate; the centre piece carries the meaning. */
    alt: "";
    aspect: `${number} / ${number}`;
    motion: FloatMotion;
    /** Seconds per half-cycle. Different for every card, so none move in step. */
    duration: number;
    delay: number;
    /** Placement per layout. Literal class strings so Tailwind can see them. */
    className: string;
    /** How far the card steps back when the centre is hovered, in px. */
    nudge: readonly [number, number];
    label?: CardLabel;
    /** A cut-out: show the transparency grid behind it. */
    transparent?: boolean;
    video?: HeroVideoSource;
}

/**
 * Around the centre on tablet and desktop; phones get their own, smaller arrangement (two cards on
 * the corners) rather than a shrunken copy of this one. Each card pairs with one of the four tools.
 */
export const cards: readonly HeroCard[] = [
    {
        id: "watch-denim",
        src: watchDenim,
        alt: "",
        aspect: "4 / 5",
        motion: "tilt",
        duration: 9,
        delay: 1.5,
        className: "max-md:hidden md:left-[3%] md:top-[2%] md:w-[14%] lg:top-0 lg:w-[13%]",
        nudge: [-6, -4],
    },
    {
        id: "camera-flatlay",
        src: cameraFlatlay,
        alt: "",
        aspect: "4 / 3",
        motion: "float-x",
        duration: 8,
        delay: 2.4,
        className: "hidden xl:block xl:left-[1%] xl:top-[71%] xl:w-[16%]",
        nudge: [-6, 4],
        label: "cropped",
    },
    {
        id: "blueberries",
        src: blueberries,
        alt: "",
        aspect: "1 / 1",
        motion: "float-y",
        duration: 7,
        delay: 1.8,
        className: "max-md:left-0 max-md:top-[44%] max-md:w-[26%] md:right-[7%] md:top-[3%] md:w-[12%]",
        nudge: [6, -4],
        label: "upscaled",
    },
    {
        id: "shoe-cutout",
        src: shoeCutout,
        alt: "",
        aspect: "4 / 3",
        motion: "breathe",
        duration: 10,
        delay: 2,
        className: "max-md:right-0 max-md:top-0 max-md:w-[34%] md:right-0 md:top-[36%] md:w-[19%]",
        nudge: [8, 0],
        label: "backgroundRemoved",
        transparent: true,
    },
    {
        id: "makeup-kit",
        src: makeupKit,
        alt: "",
        aspect: "4 / 3",
        motion: "drift",
        duration: 6,
        delay: 2.8,
        className: "hidden lg:block lg:right-[6%] lg:top-[73%] lg:w-[15%]",
        nudge: [6, 4],
        label: "edited",
    },
];
