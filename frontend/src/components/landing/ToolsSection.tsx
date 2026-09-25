import { ArrowRight, Crop, Eraser, SlidersHorizontal, ZoomIn } from "lucide-react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useInView } from "@/hooks/useInView";
import { ROUTES } from "@/lib/constants/routes";
import { SectionHeading } from "./SectionHeading";
import { useT } from "@/i18n";

const TOOLS = [
    {
        key: "removeBackground",
        icon: Eraser,
        href: ROUTES.removeBackground,
    },
    {
        key: "upscale",
        icon: ZoomIn,
        href: ROUTES.upscale,
    },
    {
        key: "crop",
        icon: Crop,
        href: ROUTES.crop,
    },
    {
        key: "editor",
        icon: SlidersHorizontal,
        href: ROUTES.editor,
    },
] as const;

export function ToolsSection() {
    const t = useT();
    const [ref, inView] = useInView<HTMLElement>();
    return (
        <section ref={ref} data-inview={inView} id="tools" aria-labelledby="tools-title" className="scroll-mt-20 py-20 md:py-24">
            <div className="page-container">
                <SectionHeading
                    id="tools-title"
                    badge={t.toolsSection.badge}
                    title={t.toolsSection.title}
                    description={t.toolsSection.description}
                />
                <div className="mt-12 grid gap-5 sm:grid-cols-2 md:mt-14 lg:grid-cols-4 lg:gap-6">
                    {TOOLS.map(({ key, icon: Icon, href }, index) => {
                        const { title, description } = t.toolsSection.items[key];
                        return (
                        <Link
                            key={title}
                            to={href}
                            className="reveal card group flex flex-col p-6 transition-[translate,box-shadow] duration-300 ease-[var(--ease-out)] hover:-translate-y-1 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4"
                            style={{ "--i": index + 3 } as CSSProperties}
                        >
                            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-[0_8px_20px_-8px_rgb(3_105_161/0.7)]">
                                <Icon className="size-5" aria-hidden />
                            </span>
                            <h3 className="mt-6 text-xl font-semibold text-primary">{title}</h3>
                            <p className="mt-2 flex-1 text-[0.9375rem] leading-relaxed text-tertiary">{description}</p>
                            <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)]">
                                {t.common.openTool}
                                <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                            </span>
                        </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
