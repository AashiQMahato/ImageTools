import { useState } from "react";
import { useInView } from "@/hooks/useInView";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import type { HeroVideoSource } from "./heroAssets";

interface HeroVideoProps {
    /** Optional: without a clip (or when it can't play) the poster is shown, so the slot never breaks. */
    video?: HeroVideoSource;
    poster: string;
    alt: string;
    className?: string;
}

/**
 * A muted, looping clip for a hero card. It mounts only once the card is near the viewport, never
 * autoplays under reduced motion, and falls back to its poster on any error — the layout is the
 * same either way, because the poster is exactly what the first frame should look like.
 */
export function HeroVideo({ video, poster, alt, className }: HeroVideoProps) {
    const reduceMotion = usePrefersReducedMotion();
    const [ref, near] = useInView<HTMLDivElement>({ rootMargin: "200px" });
    const [failed, setFailed] = useState(false);
    const playable = Boolean(video) && !reduceMotion && !failed;

    return (
        <div ref={ref} className={cn("relative size-full", className)}>
            {playable && near && video ? (
                <video
                    className="size-full object-cover"
                    poster={poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden={alt === "" || undefined}
                    aria-label={alt || undefined}
                    onError={() => setFailed(true)}
                >
                    <source src={video.src} type={video.type} onError={() => setFailed(true)} />
                </video>
            ) : (
                <img src={poster} alt={alt} className="size-full object-cover" loading="lazy" decoding="async" draggable={false} />
            )}
        </div>
    );
}
