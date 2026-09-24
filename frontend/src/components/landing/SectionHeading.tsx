import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SectionHeadingProps {
    badge: string;
    title: ReactNode;
    description?: ReactNode;
    /** Optional action aligned to the right on wide screens (e.g. an outline button). */
    action?: ReactNode;
    id?: string;
    className?: string;
}

/** Badge, title and description on the left; an optional action on the right, aligned to the description. */
export function SectionHeading({ badge, title, description, action, id, className }: SectionHeadingProps) {
    return (
        <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
            <div className="max-w-3xl">
                <p className="reveal section-badge">{badge}</p>
                <h2 id={id} className="reveal mt-4 text-section text-balance text-primary [--i:1]">
                    {title}
                </h2>
                {description && <p className="reveal mt-4 text-lead text-pretty text-tertiary [--i:2]">{description}</p>}
            </div>
            {action && <div className="reveal shrink-0 [--i:3]">{action}</div>}
        </div>
    );
}
