import { UploadButton } from "@/components/common/UploadButton";
import { useInView } from "@/hooks/useInView";
import { UPLOAD_HINT } from "@/lib/constants/upload";

const STEPS = ["Upload", "Transform", "Download"];

export function FinalCTA() {
    const [ref, inView] = useInView<HTMLElement>();

    return (
        <section ref={ref} data-inview={inView} aria-labelledby="cta-title" className="pb-24 md:pb-32">
            <div className="page-container">
                {/* A dark closing tile: the page's last, calmest moment. */}
                <div className="dark-mode tile flex flex-col items-center px-6 py-20 text-center md:py-28">
                    <ol className="reveal flex items-center gap-2 text-sm font-medium whitespace-nowrap text-tertiary sm:gap-3" aria-label="How it works">
                        {STEPS.map((step, index) => (
                            <li key={step} className="flex items-center gap-2 sm:gap-3">
                                {index > 0 && <span className="h-px w-4 bg-border-primary sm:w-6 md:w-10" aria-hidden />}
                                <span>
                                    <span className="text-quaternary tabular-nums">{index + 1}</span> {step}
                                </span>
                            </li>
                        ))}
                    </ol>
                    <h2 id="cta-title" className="reveal mt-6 text-section text-balance text-primary [--i:1]">
                        Ready when
                        <br />
                        <span className="text-quaternary">your image is.</span>
                    </h2>
                    <UploadButton size="xl" className="reveal mt-10 [--i:2]" buttonClassName="rounded-full px-7 py-3.5 before:rounded-full" />
                    <p className="reveal mt-6 text-sm text-quaternary [--i:3]">{UPLOAD_HINT}</p>
                </div>
            </div>
        </section>
    );
}
