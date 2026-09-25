import { Crop, Eraser, SlidersHorizontal, ZoomIn } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useInView } from "@/hooks/useInView";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { EditControls } from "./EditControls";
import { FloatingImageCard } from "./FloatingImageCard";
import { cards } from "./heroAssets";
import { ImageTransformation } from "./ImageTransformation";

/** Each chip lights up while the centre piece is in its moment (seconds into the loop). */
const TOOLS = [
    { key: "remove", switcher: "removeBackground", href: ROUTES.removeBackground, icon: Eraser, start: 3 },
    { key: "upscale", switcher: "upscale", href: ROUTES.upscale, icon: ZoomIn, start: 5.04 },
    { key: "crop", switcher: "crop", href: ROUTES.crop, icon: Crop, start: 6.96 },
    { key: "edit", switcher: "editor", href: ROUTES.editor, icon: SlidersHorizontal, start: 9 },
] as const;

/**
 * The hero's image-processing playground: the pipeline running on the centre piece, real outputs
 * floating around it, and the four tools as links that follow along. Phones get their own layout —
 * the centre piece full width with two cards on its corners — not a shrunken copy of this one.
 */
export function HeroVisual({ className }: { className?: string }) {
    const t = useT();
    // Nothing needs to move while the hero is scrolled away; everything pauses on the same frame.
    const [ref, inView] = useInView<HTMLDivElement>({ once: false, rootMargin: "0px" });


    return (
        <div
            ref={ref}
            role="group"
            aria-label={t.hero.visualLabel}
            data-offscreen={inView ? undefined : ""}
            className={cn("hero-visual relative mx-auto w-full max-w-[75rem] px-3 pt-6 md:aspect-[16/10] md:px-0 md:pt-0 lg:aspect-[20/9]", className)}
        >
            {cards.map((card) => (
                <FloatingImageCard
                    key={card.id}
                    src={card.src}
                    alt={card.alt}
                    aspect={card.aspect}
                    motion={card.motion}
                    animationDuration={card.duration}
                    animationDelay={card.delay}
                    className={card.className}
                    nudge={card.nudge}
                    label={card.label && t.hero.cardLabels[card.label]}
                    transparent={card.transparent}
                    video={card.video}
                />
            ))}

            <EditControls className="z-20 hidden md:top-[36%] md:left-[2%] md:block md:w-[22%] lg:top-[39%] lg:left-[12%] lg:w-[16%]" />

            <div className="relative z-10 mx-auto w-full max-w-md md:absolute md:top-1/2 md:left-1/2 md:w-[48%] md:max-w-none md:-translate-x-1/2 md:-translate-y-1/2 lg:w-[44%]">
                <ImageTransformation />

                <ul className="mt-4 flex justify-center gap-1 rounded-full border border-secondary bg-primary p-1 shadow-lg md:absolute md:bottom-0 md:left-1/2 md:mt-0 md:-translate-x-1/2 md:translate-y-1/2">
                    {TOOLS.map((tool) => {
                        const Icon = tool.icon;
                        const face = "col-start-1 row-start-1 flex items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 sm:px-3";
                        return (
                            <li key={tool.key}>
                                <Link
                                    to={tool.href}
                                    aria-label={t.toolPage.switcher[tool.switcher]}
                                    className="hero-chip grid rounded-full text-xs font-medium whitespace-nowrap text-secondary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-sm"
                                >
                                    <span className={face}>
                                        <Icon className="hero-chip-icon size-3.5 sm:size-4" aria-hidden />
                                        {t.hero.chips[tool.key]}
                                    </span>
                                    {/* The lit state: a solid brand fill, shown only during this tool's moment. */}
                                    <span
                                        aria-hidden
                                        className={cn(face, "hero-timeline hero-window hero-chip-on bg-brand-solid text-white")}
                                        style={{ "--start": `${tool.start}s` } as CSSProperties}
                                    >
                                        <Icon className="size-3.5 sm:size-4" />
                                        {t.hero.chips[tool.key]}
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
