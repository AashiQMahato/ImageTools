import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface ProcessingBadgeProps {
    children: ReactNode;
    /** "sm" on the stage, "xs" on the small floating cards. */
    size?: "sm" | "xs";
    /** Leading mark; a check by default, since every badge reports something already done. */
    icon?: ReactNode;
    className?: string;
    style?: CSSProperties;
}

/** A processing result, stated in words next to its mark — never colour alone. */
export function ProcessingBadge({ children, size = "sm", icon, className, style }: ProcessingBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-secondary bg-primary font-medium whitespace-nowrap text-primary shadow-sm",
                size === "sm" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[0.6875rem]",
                className,
            )}
            style={style}
        >
            <span className="flex text-success-primary" aria-hidden>
                {icon ?? <Check className={size === "sm" ? "size-3.5" : "size-3"} strokeWidth={2.75} />}
            </span>
            {children}
        </span>
    );
}
