import { Crop, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { central } from "./heroAssets";
import { ProcessingBadge } from "./ProcessingBadge";

/** Seconds into the 12 s loop at which each moment begins (see the HERO keyframes in index.css). */
const AT = {
    backgroundRemoved: 3.96,
    upscaled: 6,
    crop: [7.26, 7.98, 8.58] as const,
    edited: 9.54,
    ready: 10.62,
} as const;

const at = (seconds: number) => ({ "--start": `${seconds}s` }) as CSSProperties;

/**
 * The centre piece: one photo taken through the app's own pipeline on a loop — background removed
 * (the real rembg cut-out, wiped in), upscaled (a genuine 4× downsample resolving to full detail),
 * cropped through three ratios, then colour-edited, and back.
 *
 * The un-animated state of every layer is the reduced-motion picture: the background removed.
 */
export function ImageTransformation({ className }: { className?: string }) {
    const t = useT();
    const shade = "hero-timeline absolute inset-0 bg-overlay/55";

    return (
        <div className={cn("hero-central", className)}>
            <div className="hero-lift relative rounded-2xl">
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-secondary bg-secondary shadow-xl">
                    <div aria-hidden className="hero-checker absolute inset-0" />

                    {/* Everything the edit grade applies to: the cut-out, and the original over it. */}
                    <div className="hero-timeline hero-edit absolute inset-0">
                        <img
                            src={central.after.src}
                            srcSet={central.after.srcSet}
                            sizes={central.sizes}
                            alt=""
                            className="absolute inset-0 size-full object-cover"
                            decoding="async"
                            draggable={false}
                        />
                        <div className="hero-timeline hero-curtain absolute inset-0 overflow-hidden">
                            <img
                                src={central.before.src}
                                srcSet={central.before.srcSet}
                                sizes={central.sizes}
                                alt={t.hero.centralAlt}
                                className="hero-timeline hero-curtain-inner absolute inset-0 size-full object-cover"
                                fetchPriority="high"
                                draggable={false}
                            />
                            <span aria-hidden className="hero-timeline hero-scan absolute inset-y-0 left-0 w-0.5 bg-white shadow-[0_0_14px_2px_var(--color-white)]" />
                        </div>
                    </div>

                    {/* Upscale: a loupe over the dial. */}
                    <div aria-hidden className="hero-timeline hero-loupe absolute top-[48%] left-[48.3%] w-[34%] -translate-x-1/2 -translate-y-1/2">
                        <div className="relative aspect-square overflow-hidden rounded-full border-2 border-white shadow-2xl">
                            <div className="hero-checker absolute inset-0" />
                            <img src={central.detail.lowres} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />
                            <img src={central.detail.sharp} alt="" className="hero-timeline hero-loupe-sharp absolute inset-0 size-full object-cover" draggable={false} />
                        </div>
                    </div>

                    {/* Crop: shades close in from the edges; their inner edge is the frame. */}
                    <div aria-hidden className="hero-timeline hero-crop pointer-events-none absolute inset-0">
                        <div className={cn(shade, "hero-shade-left border-r-2 border-white")} />
                        <div className={cn(shade, "hero-shade-right border-l-2 border-white")} />
                        <div className={cn(shade, "hero-shade-top border-b-2 border-white")} />
                        <div className={cn(shade, "hero-shade-bottom border-t-2 border-white")} />
                    </div>

                    {/* One slot, several messages — each shown in its own moment. */}
                    <div aria-hidden className="absolute top-3 left-3 grid">
                        <ProcessingBadge className="hero-timeline hero-window hero-flash hero-static-visible col-start-1 row-start-1" style={at(AT.backgroundRemoved)}>
                            {t.hero.badges.backgroundRemoved}
                        </ProcessingBadge>
                        <ProcessingBadge className="hero-timeline hero-window hero-flash col-start-1 row-start-1" style={at(AT.upscaled)}>
                            {t.hero.badges.upscaled}
                        </ProcessingBadge>
                        {(["1:1", "4:5", "16:9"] as const).map((ratio, index) => (
                            <ProcessingBadge
                                key={ratio}
                                icon={<Crop className="size-3.5" strokeWidth={2.5} />}
                                className="hero-timeline hero-window hero-flash-short col-start-1 row-start-1"
                                style={at(AT.crop[index]!)}
                            >
                                {t.hero.badges.crop} <span className="tabular-nums">{ratio}</span>
                            </ProcessingBadge>
                        ))}
                        <ProcessingBadge icon={<Sparkles className="size-3.5" strokeWidth={2.5} />} className="hero-timeline hero-window hero-flash col-start-1 row-start-1" style={at(AT.edited)}>
                            {t.hero.badges.edited}
                        </ProcessingBadge>
                        <ProcessingBadge className="hero-timeline hero-window hero-flash col-start-1 row-start-1" style={at(AT.ready)}>
                            {t.hero.badges.ready}
                        </ProcessingBadge>
                    </div>
                </div>
            </div>
        </div>
    );
}
