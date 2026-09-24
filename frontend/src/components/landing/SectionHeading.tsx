import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SectionHeadingProps {
    eyebrow: string;
    title: ReactNode;
    description?: ReactNode;
    align?: "center" | "start";
    /** "chapter" is a step smaller, for headings inside tiles. */
    size?: "section" | "chapter";
    className?: string;
    /** id for the heading, so the section can be labelled by it. */
    id?: string;
}

export function SectionHeading({ eyebrow, title, description, align = "start", size = "section", className, id }: SectionHeadingProps) {
    return (
        <div className={cn("flex flex-col", align === "center" && "items-center text-center", className)}>
            <p className="reveal text-eyebrow text-tertiary">{eyebrow}</p>
            <h2 id={id} className={cn("reveal mt-3 text-balance text-primary [--i:1]", size === "chapter" ? "text-chapter" : "text-section")}>
                {title}
            </h2>
            {description && <p className="reveal mt-6 max-w-[38rem] text-lead text-pretty text-tertiary [--i:2]">{description}</p>}
        </div>
    );
}
