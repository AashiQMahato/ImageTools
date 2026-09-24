import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useInView } from "@/hooks/useInView";
import { ROUTES } from "@/lib/constants/routes";
import { MiniEditor } from "./MiniEditor";
import { SectionHeading } from "./SectionHeading";

export function EditorSection() {
    const [ref, inView] = useInView<HTMLElement>({ rootMargin: "0px 0px -25% 0px" });

    return (
        <section ref={ref} data-inview={inView} aria-labelledby="editor-title" className="pt-28 md:pt-44">
            <div className="page-container">
                <div className="tile grid items-center gap-10 overflow-hidden px-4 py-10 sm:px-10 sm:py-12 md:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20 lg:pr-12 lg:pl-16">
                    <div className="px-2 sm:px-0">
                        <SectionHeading
                            id="editor-title"
                            size="chapter"
                            eyebrow="Crop & rotate"
                            title={
                                <>
                                    Frame it just right.
                                    <br />
                                    <span className="text-quaternary">In any format.</span>
                                </>
                            }
                            description="Straighten the composition, fit square, portrait or widescreen, and export at the size you need."
                        />
                        <Link to={ROUTES.crop} className="reveal link-accent group mt-8 inline-flex items-center gap-0.5 text-lg font-medium [--i:3]">
                            Open the cropper
                            <ChevronRight className="size-4.5 translate-y-px transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
                        </Link>
                    </div>

                    <div className="reveal min-w-0 [--i:2]">
                        <MiniEditor play={inView} />
                    </div>
                </div>
            </div>
        </section>
    );
}
