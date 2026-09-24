import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

/** The mark: a frame with a subject cut out of it. */
export function LogoMark({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
            <rect x="1" y="1" width="22" height="22" rx="6" className="fill-fg-primary" />
            <circle cx="12" cy="10" r="3.25" className="fill-bg-primary" />
            <path d="M6 18.5c1-3 3.3-4.5 6-4.5s5 1.5 6 4.5" className="fill-bg-primary" />
        </svg>
    );
}

export function Logo({ className }: { className?: string }) {
    return (
        <Link
            to={ROUTES.home}
            aria-label="Image Tools home"
            className={cn(
                "flex items-center gap-2 rounded-md text-md font-semibold tracking-[-0.01em] text-primary outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4",
                className,
            )}
        >
            <LogoMark />
            Image Tools
        </Link>
    );
}
