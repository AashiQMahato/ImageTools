import { Check, PlayCircle } from "lucide-react";
import { useRef, useState } from "react";
import { UploadButton } from "@/components/common/UploadButton";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils/cn";
import { HeroDemo, type HeroDemoHandle } from "./HeroDemo";
import { outlinePill } from "./OutlineLink";
import { useT } from "@/i18n";


export function Hero() {
    const t = useT();
    const demoRef = useRef<HeroDemoHandle>(null);
    const demoContainerRef = useRef<HTMLDivElement>(null);
    const reduceMotion = usePrefersReducedMotion();
    const [uploadError, setUploadError] = useState<string | null>(null);

    const tryDemo = () => {
        const container = demoContainerRef.current;
        if (!container) return;
        const visible = container.getBoundingClientRect().top < window.innerHeight * 0.6;
        if (!visible) container.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
        window.setTimeout(() => demoRef.current?.run(), visible || reduceMotion ? 0 : 650);
    };

    return (
        <section aria-labelledby="hero-title" className="hero-glow -mt-16 pt-16">
            <div className="page-container grid items-center gap-14 py-16 md:py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16 lg:py-28">
                <div>
                    <p className="animate-enter section-badge [--i:1]">{t.hero.badge}</p>
                    <h1 id="hero-title" className="animate-enter mt-5 text-hero text-balance text-primary [--i:2]">
                        {t.hero.title}
                    </h1>
                    <p className="animate-enter mt-5 max-w-xl text-lead text-pretty text-tertiary [--i:3]">
                        {t.hero.description}
                    </p>

                    <div className="animate-enter mt-9 flex flex-wrap items-center gap-3 [--i:4]">
                        <UploadButton
                            size="xl"
                            onErrorChange={setUploadError}
                            buttonClassName="btn-primary min-h-13 rounded-full px-7 text-[1.0625rem] ring-0 before:hidden"
                        />
                        <button type="button" onClick={tryDemo} className={cn(outlinePill, "min-h-13 px-6 text-[1.0625rem]")}>
                            <PlayCircle className="size-5 text-fg-quaternary" aria-hidden />
                            {t.hero.tryDemo}
                        </button>
                    </div>

                    <p role="status" className={cn("animate-enter mt-5 text-sm [--i:5]", uploadError ? "text-error-primary" : "text-quaternary")}>
                        {uploadError ?? t.common.uploadHint}
                    </p>

                    <ul className="animate-enter mt-8 flex flex-wrap gap-x-6 gap-y-2 [--i:6]">
                        {t.hero.points.map((point) => (
                            <li key={point} className="flex items-center gap-2 text-sm font-medium text-secondary">
                                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--indigo-soft)] text-[var(--indigo)]">
                                    <Check className="size-3" strokeWidth={3} aria-hidden />
                                </span>
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* The product, framed like a device: an outer bezel card holding the live demo. */}
                <div ref={demoContainerRef} className="animate-enter [--i:4]">
                    <div className="card rounded-[2rem] p-3 sm:p-4">
                        <HeroDemo ref={demoRef} />
                    </div>
                </div>
            </div>
        </section>
    );
}
