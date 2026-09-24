import { useRef, useState } from "react";
import { images } from "@/assets/images/landing";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { pinnedProgress, useScrollProgress } from "@/hooks/useScrollProgress";
import { cn } from "@/lib/utils/cn";
import { CompareSlider } from "@/components/common/CompareSlider";

const BACKGROUNDS = [
    { id: "transparent", label: "Transparent", color: null },
    { id: "white", label: "White", color: "#ffffff" },
    { id: "sand", label: "Sand", color: "#e8e2d6" },
    { id: "slate", label: "Slate", color: "#5b6470" },
    { id: "ink", label: "Ink", color: "#18181b" },
] as const;

type BackgroundId = (typeof BACKGROUNDS)[number]["id"];

/** The backdrop the story settles on if the visitor hasn't picked one. */
const STORY_BACKGROUND: BackgroundId = "sand";

const imageClass = "absolute inset-0 size-full object-cover object-[72%_50%] sm:object-center";
const sizes = "(min-width: 1200px) 1136px, 100vw";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const segment = (progress: number, start: number, end: number) => clamp01((progress - start) / (end - start));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * A pinned chapter: scrolling scrubs the story. First the background is removed (the divider sweeps
 * right to left), then a new backdrop fills in. Dragging or choosing a swatch hands control to the visitor.
 */
export function BackgroundRemovalSection() {
    const sectionRef = useRef<HTMLElement>(null);
    const reduceMotion = usePrefersReducedMotion();
    const [progress, setProgress] = useState(0);
    const [manualPosition, setManualPosition] = useState<number | null>(null);
    const [manualBackground, setManualBackground] = useState<BackgroundId | null>(null);

    useScrollProgress(sectionRef, pinnedProgress, setProgress, !reduceMotion);

    const removeStep = reduceMotion ? 1 : easeInOut(segment(progress, 0.06, 0.52));
    const backdropStep = reduceMotion ? 0 : easeInOut(segment(progress, 0.6, 0.84));

    const position = manualPosition ?? (reduceMotion ? 50 : 100 - removeStep * 100);
    const backgroundId = manualBackground ?? (backdropStep > 0.5 ? STORY_BACKGROUND : "transparent");
    const background = BACKGROUNDS.find((option) => option.id === backgroundId) ?? BACKGROUNDS[0];
    const backdropOpacity = manualBackground ? (background.color ? 1 : 0) : backdropStep;
    const backdropColor = manualBackground ? background.color : BACKGROUNDS.find((b) => b.id === STORY_BACKGROUND)?.color;

    return (
        <section
            ref={sectionRef}
            aria-labelledby="remove-bg-title"
            className={cn("relative", reduceMotion ? "py-24 md:py-32" : "h-[240vh] md:h-[280vh]")}
        >
            <div className={cn("flex flex-col justify-center", !reduceMotion && "sticky top-0 h-svh pt-14")}>
                <div className="page-container flex flex-col items-center text-center">
                    <p className="text-eyebrow text-tertiary">Background removal</p>
                    <h2 id="remove-bg-title" className="mt-2 text-chapter text-balance text-primary">
                        Remove the background. <span className="text-quaternary">Keep the subject.</span>
                    </h2>

                    <CompareSlider
                        value={position}
                        onChange={setManualPosition}
                        beforeLabel="Original"
                        afterLabel="Background removed"
                        className={cn(
                            "mt-8 aspect-[4/5] rounded-[1.75rem] shadow-canvas sm:aspect-[3/2] md:mt-10",
                            // Fit the stage to whichever is tighter: the viewport height (it's pinned) or the width.
                            "h-[min(calc(100svh-21rem),calc((100vw-2.5rem)*1.25))] sm:h-[min(calc(100svh-21rem),calc((100vw-4rem)/1.5),757px)]",
                        )}
                        before={
                            <img
                                {...images.heron}
                                sizes={sizes}
                                alt="A striated heron standing on a weathered stone ledge above golden water"
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                                className={imageClass}
                            />
                        }
                        after={
                            <>
                                <div className="absolute inset-0 bg-checkerboard" />
                                <div
                                    className="absolute inset-0 transition-[background-color] duration-500"
                                    style={{ backgroundColor: backdropColor ?? "transparent", opacity: backdropOpacity }}
                                />
                                <img
                                    {...images.heronCutout}
                                    sizes={sizes}
                                    alt="The same heron cut out from its background"
                                    loading="lazy"
                                    decoding="async"
                                    draggable={false}
                                    className={imageClass}
                                />
                            </>
                        }
                    />

                    <div className="mt-6 flex w-full max-w-md flex-col items-center gap-5 md:mt-8">
                        {!reduceMotion && (
                            <ol className="grid w-full grid-cols-2 gap-4" aria-label="Steps">
                                <Step index={1} label="Remove the background" progress={manualPosition === null ? removeStep : 1} />
                                <Step index={2} label="Place it anywhere" progress={manualBackground ? 1 : backdropStep} />
                            </ol>
                        )}
                        <BackgroundPicker
                            value={backgroundId}
                            onChange={(id) => {
                                setManualBackground(id);
                                if (manualPosition === null) setManualPosition(Math.min(position, 50));
                            }}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

function Step({ index, label, progress }: { index: number; label: string; progress: number }) {
    const active = progress > 0 && progress < 1;
    const done = progress >= 1;
    return (
        <li className="flex flex-col gap-2 text-left">
            <span className="h-0.5 overflow-hidden rounded-full bg-border-secondary">
                <span className="block h-full origin-left rounded-full bg-fg-primary" style={{ transform: `scaleX(${progress})` }} />
            </span>
            <span className={cn("text-sm font-medium transition-colors duration-300", active || done ? "text-primary" : "text-quaternary")}>
                <span className="text-quaternary tabular-nums">{index}.</span> {label}
            </span>
        </li>
    );
}

function BackgroundPicker({ value, onChange }: { value: BackgroundId; onChange: (id: BackgroundId) => void }) {
    return (
        <div role="radiogroup" aria-label="Background" className="flex items-center gap-2.5">
            {BACKGROUNDS.map((option) => {
                const checked = option.id === value;
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        aria-label={option.label}
                        title={option.label}
                        onClick={() => onChange(option.id)}
                        className={cn(
                            // 44px hit area around a 28px swatch.
                            "relative size-7 cursor-pointer rounded-full ring-1 ring-black/10 ring-inset transition-transform duration-500 ease-[var(--ease-spring)] active:scale-90 dark:ring-white/15",
                            "before:absolute before:-inset-2 before:content-['']",
                            "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4",
                            "after:absolute after:-inset-[5px] after:rounded-full after:ring-2 after:transition-opacity after:duration-300",
                            checked ? "after:opacity-100 after:ring-fg-primary" : "after:opacity-0",
                            !option.color && "bg-checkerboard [background-size:8px_8px]",
                        )}
                        style={option.color ? { backgroundColor: option.color } : undefined}
                    />
                );
            })}
        </div>
    );
}
