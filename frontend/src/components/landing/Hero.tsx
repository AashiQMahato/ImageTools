import { ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { UploadButton } from "@/components/common/UploadButton";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { enterProgress, useScrollProgress } from "@/hooks/useScrollProgress";
import { UPLOAD_HINT } from "@/lib/constants/upload";
import { cn } from "@/lib/utils/cn";
import { HeroDemo, type HeroDemoHandle } from "./HeroDemo";

/** How small the demo starts before scrolling brings it up to full size. */
const START_SCALE = 0.9;

export function Hero() {
    const demoRef = useRef<HeroDemoHandle>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const scalerRef = useRef<HTMLDivElement>(null);
    const reduceMotion = usePrefersReducedMotion();
    const [uploadError, setUploadError] = useState<string | null>(null);

    // The product grows toward you as you scroll to it — it "hints in the direction" of where the page is going.
    useScrollProgress(
        stageRef,
        enterProgress(1, 0.3),
        (progress) => {
            const eased = 1 - (1 - progress) ** 2;
            if (scalerRef.current) scalerRef.current.style.transform = `scale(${START_SCALE + (1 - START_SCALE) * eased})`;
        },
        !reduceMotion,
    );

    const tryDemo = () => {
        const stage = stageRef.current;
        if (!stage) return;
        const alreadyVisible = stage.getBoundingClientRect().top < window.innerHeight * 0.4;
        stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        // Let the scroll land before the demo starts, so the change is actually seen.
        window.setTimeout(() => demoRef.current?.run(), alreadyVisible || reduceMotion ? 0 : 700);
    };

    return (
        <section aria-labelledby="hero-title" className="overflow-x-clip pt-16 pb-16 md:pt-28 md:pb-24">
            <div className="page-container flex flex-col items-center text-center">
                <p className="animate-enter text-eyebrow text-tertiary [--i:1]">Remove · Upscale · Crop · Resize</p>
                <h1 id="hero-title" className="animate-enter mt-4 text-hero text-balance text-primary [--i:2]">
                    Your images,
                    <br />
                    <span className="text-quaternary">at their best.</span>
                </h1>
                <p className="animate-enter mt-7 max-w-[36rem] text-lead text-pretty text-tertiary [--i:3]">
                    Clean up backgrounds, restore detail and reframe your photos in a few clicks. No design skills required.
                </p>

                <div className="animate-enter mt-10 flex flex-col items-center gap-x-8 gap-y-5 sm:flex-row [--i:4]">
                    <UploadButton size="xl" onErrorChange={setUploadError} buttonClassName="rounded-full px-7 py-3.5 before:rounded-full" />
                    <button
                        type="button"
                        onClick={tryDemo}
                        className="link-accent group inline-flex cursor-pointer items-center gap-0.5 text-lg font-medium tracking-[-0.015em]"
                    >
                        Try the demo
                        <ChevronRight
                            className="size-4.5 translate-y-px transition-transform duration-300 ease-[var(--ease-out)] group-hover:translate-x-0.5"
                            aria-hidden
                        />
                    </button>
                </div>
                <p
                    role="status"
                    className={cn("animate-enter mt-6 text-sm [--i:5]", uploadError ? "text-error-primary" : "text-quaternary")}
                >
                    {uploadError ?? UPLOAD_HINT}
                </p>
            </div>

            <div ref={stageRef} className="page-container animate-enter mt-16 md:mt-20 [--i:6]">
                <div ref={scalerRef} className="origin-top will-change-transform" style={reduceMotion ? undefined : { transform: `scale(${START_SCALE})` }}>
                    <HeroDemo ref={demoRef} />
                </div>
            </div>
        </section>
    );
}
