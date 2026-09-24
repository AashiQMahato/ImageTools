import { Download, Link2, RotateCw } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { images, KINGFISHER_CUTOUT_PNG } from "@/assets/images/landing";
import { Button } from "@/components/ui/base/buttons/button";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils/cn";
import { downloadFile } from "@/lib/utils/download";
import { CompareSlider } from "@/components/common/CompareSlider";
import { SectionHeading } from "./SectionHeading";

export function EssentialsBento() {
    const [ref, inView] = useInView<HTMLElement>();

    return (
        <section ref={ref} data-inview={inView} aria-labelledby="essentials-title" className="py-28 md:py-44">
            <div className="page-container">
                <SectionHeading
                    id="essentials-title"
                    align="center"
                    eyebrow="Everything else"
                    title={
                        <>
                            The essentials.
                            <br />
                            <span className="text-quaternary">Done beautifully.</span>
                        </>
                    }
                />

                <div className="mt-14 grid gap-4 md:mt-20 md:grid-cols-2 lg:grid-cols-6 lg:gap-5">
                    <Tile className="md:col-span-2 lg:col-span-4" index={0} title="Resize to the pixel." description="Exact dimensions, with the aspect ratio locked.">
                        <ResizeVisual />
                    </Tile>
                    <Tile className="lg:col-span-2" index={1} title="The formats you use." description="Upload up to 10 MB.">
                        <FormatsVisual />
                    </Tile>
                    <Tile className="lg:col-span-2" index={2} title="Rotate and flip." description="Straighten any shot in a click.">
                        <RotateVisual />
                    </Tile>
                    <Tile className="lg:col-span-2" index={3} title="Before and after." description="Compare the result with the original.">
                        <CompareVisual />
                    </Tile>
                    <Tile className="md:col-span-2 lg:col-span-2" index={4} title="Ready to download." description="A transparent PNG, ready to use anywhere.">
                        <DownloadVisual />
                    </Tile>
                </div>
            </div>
        </section>
    );
}

interface TileProps {
    title: string;
    description: string;
    index: number;
    className?: string;
    children: ReactNode;
}

function Tile({ title, description, index, className, children }: TileProps) {
    return (
        <article className={cn("tile reveal flex flex-col overflow-hidden p-7 md:p-8", className)} style={{ "--i": index } as CSSProperties}>
            <h3 className="text-xl font-bold tracking-[-0.02em] text-primary md:text-2xl">{title}</h3>
            <p className="mt-1.5 text-md text-tertiary">{description}</p>
            <div className="mt-8 flex flex-1 items-end">{children}</div>
        </article>
    );
}

const PRESETS = [
    { label: "1:1", width: 1080, height: 1080 },
    { label: "4:5", width: 1080, height: 1350 },
    { label: "16:9", width: 1920, height: 1080 },
    { label: "9:16", width: 1080, height: 1920 },
] as const;

function ResizeVisual() {
    const [preset, setPreset] = useState<(typeof PRESETS)[number]>(PRESETS[1]);
    const field = "flex h-16 min-w-0 flex-1 flex-col justify-center rounded-2xl bg-primary px-4 shadow-xs sm:px-5";

    return (
        <div className="flex w-full flex-col gap-5">
            <div className="flex items-center gap-3">
                <div className={field}>
                    <span className="text-xs text-quaternary">Width</span>
                    <span className="text-xl font-semibold tracking-[-0.02em] text-primary tabular-nums">{preset.width.toLocaleString("en-US")}</span>
                </div>
                <Link2 className="size-5 shrink-0 text-fg-quaternary" aria-label="Aspect ratio locked" />
                <div className={field}>
                    <span className="text-xs text-quaternary">Height</span>
                    <span className="text-xl font-semibold tracking-[-0.02em] text-primary tabular-nums">{preset.height.toLocaleString("en-US")}</span>
                </div>
            </div>
            <div role="radiogroup" aria-label="Size preset" className="flex flex-wrap gap-2">
                {PRESETS.map((option) => {
                    const checked = option.label === preset.label;
                    return (
                        <button
                            key={option.label}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            onClick={() => setPreset(option)}
                            className={cn(
                                "min-h-10 cursor-pointer rounded-full px-4 text-sm font-medium tabular-nums transition-[color,background-color,scale] duration-200 active:scale-[0.96]",
                                "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                checked ? "bg-brand-solid text-primary_on-brand" : "bg-primary text-secondary hover:text-primary",
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function FormatsVisual() {
    return (
        <ul className="flex flex-col text-[2.75rem] leading-[1.05] font-bold tracking-[-0.04em]" aria-label="Supported formats">
            <li className="text-primary">JPG</li>
            <li className="text-tertiary">PNG</li>
            <li className="text-quaternary">WebP</li>
        </ul>
    );
}

function RotateVisual() {
    const [turns, setTurns] = useState(0);
    const [flipped, setFlipped] = useState(false);

    return (
        <div className="flex w-full flex-col items-center gap-6">
            <div className="flex h-44 w-full items-center justify-center">
                <img
                    src={images.flamingo.src}
                    alt="Flamingo thumbnail"
                    loading="lazy"
                    decoding="async"
                    className="aspect-[3/2] w-52 rounded-2xl object-cover shadow-lg transition-transform duration-[600ms] ease-[var(--ease-spring)] motion-reduce:transition-none"
                    style={{ transform: `scaleX(${flipped ? -1 : 1}) rotate(${turns * (flipped ? -90 : 90)}deg) scale(${turns % 2 ? 0.8 : 1})` }}
                />
            </div>
            <div className="flex gap-2">
                <Button size="md" color="secondary" iconLeading={RotateCw} aria-label="Rotate 90°" onPress={() => setTurns((t) => t + 1)} className="press-scale rounded-full before:rounded-full" />
                <Button
                    size="md"
                    color="secondary"
                    aria-label="Flip horizontally"
                    aria-pressed={flipped}
                    onPress={() => setFlipped((f) => !f)}
                    className="press-scale rounded-full before:rounded-full"
                    iconLeading={
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5 text-fg-quaternary" aria-hidden>
                            <path d="M12 3v18M16 7l4 5-4 5zM8 7l-4 5 4 5z" />
                        </svg>
                    }
                />
            </div>
        </div>
    );
}

function CompareVisual() {
    const [value, setValue] = useState(50);
    const imageClass = "absolute inset-0 size-full object-cover object-[32%_50%]";
    return (
        <CompareSlider
            value={value}
            onChange={setValue}
            beforeLabel="Before"
            afterLabel="After"
            className="aspect-[4/3] w-full rounded-2xl"
            before={<img src={images.kingfisher.src} alt="Kingfisher, original" loading="lazy" decoding="async" draggable={false} className={imageClass} />}
            after={
                <>
                    <div className="absolute inset-0 bg-checkerboard" />
                    <img src={images.kingfisherCutout.src} alt="Kingfisher, background removed" loading="lazy" decoding="async" draggable={false} className={imageClass} />
                </>
            }
        />
    );
}

function DownloadVisual() {
    return (
        <div className="flex w-full items-center gap-4 rounded-2xl bg-primary p-3 pr-3 shadow-xs">
            <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-checkerboard [background-size:8px_8px]">
                <img src={images.kingfisherCutout.src} alt="" loading="lazy" decoding="async" className="size-full object-cover object-[32%_50%]" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-primary">kingfisher.png</p>
                <p className="text-xs text-quaternary tabular-nums">PNG · 1600 × 1000</p>
            </div>
            <Button
                size="md"
                color="primary"
                iconLeading={Download}
                aria-label="Download sample PNG"
                onPress={() => downloadFile(KINGFISHER_CUTOUT_PNG, "kingfisher-cutout.png")}
                className="press-scale rounded-full before:rounded-full"
            />
        </div>
    );
}
