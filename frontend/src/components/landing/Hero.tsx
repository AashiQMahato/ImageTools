import { ArrowDown } from "lucide-react";
import { useState } from "react";
import { UploadButton } from "@/components/common/UploadButton";
import { Button } from "@/components/ui/base/buttons/button";
import { ROUTES } from "@/lib/constants/routes";
import { useT } from "@/i18n";
import { HeroVisual } from "./HeroVisual";

/**
 * The first viewport: what the product does, in one line, then the product doing it. The headline
 * leads; the pipeline running beneath it is the proof. Flat and solid throughout — no gradients.
 */
export function Hero() {
    const t = useT();
    const [uploadError, setUploadError] = useState<string | null>(null);
    const pill = "press-scale rounded-full before:rounded-full";

    return (
        <section aria-labelledby="hero-title" className="-mt-18 overflow-x-clip bg-primary pt-18">
            <div className="page-container pt-8 pb-16 md:pt-10 md:pb-20 lg:pt-6">
                <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                    <p className="animate-enter section-badge [--i:1]">{t.hero.badge}</p>
                    <h1 id="hero-title" className="animate-enter mt-4 text-hero text-balance text-primary [--i:2]">
                        <span className="sm:block">{t.hero.titleLead}</span> <span className="text-[var(--brand)] sm:block">{t.hero.titleAccent}</span>
                    </h1>
                    <p className="animate-enter mt-3 max-w-2xl text-lead text-pretty text-tertiary [--i:3]">{t.hero.description}</p>

                    <div className="animate-enter mt-7 flex flex-wrap items-center justify-center gap-3 [--i:4]">
                        <UploadButton size="xl" label={t.common.startEditing} navigateTo={ROUTES.editor} onErrorChange={setUploadError} buttonClassName={`${pill} px-7`} />
                        <Button size="xl" color="secondary" href="#tools" iconTrailing={ArrowDown} className={`${pill} px-6`}>
                            {t.hero.exploreTools}
                        </Button>
                    </div>
                    {uploadError && (
                        <p role="alert" className="mt-4 text-sm text-error-primary">
                            {uploadError}
                        </p>
                    )}
                </div>

                <HeroVisual className="animate-enter mt-8 md:mt-10 lg:mt-7 [--i:5]" />
            </div>
        </section>
    );
}
