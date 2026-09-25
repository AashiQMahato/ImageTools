import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";
import type { FloatMotion, HeroVideoSource } from "./heroAssets";
import { HeroVideo } from "./HeroVideo";
import { ProcessingBadge } from "./ProcessingBadge";

export interface FloatingImageCardProps {
    src: string;
    alt: string;
    className?: string;
    /** Seconds before this card starts moving. */
    animationDelay?: number;
    /** Seconds per half-cycle; the motion runs back and forth, so it loops without a seam. */
    animationDuration?: number;
    motion: FloatMotion;
    aspect: string;
    label?: string;
    /** A cut-out: the transparency grid shows through. */
    transparent?: boolean;
    /** Where the card steps to when the centre piece is hovered, in px. */
    nudge?: readonly [number, number];
    video?: HeroVideoSource;
}

/**
 * Three layers, each owning one transform: placement (and the hover step-back), the continuous
 * float, then the card itself. Keeping them apart means the hover never fights the animation.
 */
export function FloatingImageCard({
    src,
    alt,
    className,
    animationDelay = 1.5,
    animationDuration = 8,
    motion,
    aspect,
    label,
    transparent,
    nudge = [0, 0],
    video,
}: FloatingImageCardProps) {
    return (
        <div
            className={cn("hero-nudge absolute z-20", className)}
            style={{ "--nudge-x": `${nudge[0]}px`, "--nudge-y": `${nudge[1]}px` } as CSSProperties}
        >
            <div
                className="hero-float"
                style={{ "--float": `hero-${motion}`, "--float-duration": `${animationDuration}s`, "--float-delay": `${animationDelay}s` } as CSSProperties}
            >
                <figure className="relative overflow-hidden rounded-xl border border-secondary bg-primary shadow-lg" style={{ aspectRatio: aspect }}>
                    {transparent && <div aria-hidden className="hero-checker absolute inset-0" />}
                    <HeroVideo video={video} poster={src} alt={alt} />
                    {label && (
                        <ProcessingBadge size="xs" className="absolute bottom-1.5 left-1.5 max-w-[calc(100%-0.75rem)]">
                            <span className="truncate">{label}</span>
                        </ProcessingBadge>
                    )}
                </figure>
            </div>
        </div>
    );
}
