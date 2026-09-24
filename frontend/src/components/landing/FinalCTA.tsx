import { UploadButton } from "@/components/common/UploadButton";
import { useInView } from "@/hooks/useInView";
import { useT } from "@/i18n";

export function FinalCTA() {
    const t = useT();
    const [ref, inView] = useInView<HTMLElement>();
    return (
        <section ref={ref} data-inview={inView} aria-labelledby="cta-title" className="pt-8 pb-24 md:pb-28">
            <div className="page-container">
                <div className="reveal card hero-glow flex flex-col items-center px-6 py-16 text-center md:py-20">
                    <p className="section-badge">{t.cta.badge}</p>
                    <h2 id="cta-title" className="mt-4 max-w-2xl text-section text-balance text-primary">
                        {t.cta.title}
                    </h2>
                    <p className="mt-4 max-w-xl text-lead text-tertiary">{t.cta.description}</p>
                    <UploadButton size="xl" className="mt-8" buttonClassName="btn-primary min-h-13 rounded-full px-8 text-[1.0625rem] ring-0 before:hidden" />
                    <p className="mt-4 text-sm text-quaternary">{t.common.uploadHint}</p>
                </div>
            </div>
        </section>
    );
}
