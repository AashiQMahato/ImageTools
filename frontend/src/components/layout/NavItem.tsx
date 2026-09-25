import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils/cn";

interface NavItemProps {
    href: string;
    children: ReactNode;
    /** The section or page currently in view. A soft surface, never a heavy underline. */
    active?: boolean;
    onNavigate?: () => void;
    /** "bar" for the desktop row, "sheet" for the mobile menu's larger rows. */
    size?: "bar" | "sheet";
    className?: string;
}

/** A plain navigation link: a quiet resting state, full ink on hover, and a small surface when current. */
export function NavItem({ href, children, active, onNavigate, size = "bar", className }: NavItemProps) {
    return (
        <Link
            to={href}
            onClick={onNavigate}
            aria-current={active ? "location" : undefined}
            className={cn(
                "flex items-center rounded-lg font-medium transition-colors duration-150",
                "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                size === "bar" ? "h-9 px-3 text-sm" : "min-h-12 px-3 text-md",
                active ? "bg-primary_hover text-primary" : "text-secondary hover:bg-primary_hover hover:text-primary",
                className,
            )}
        >
            {children}
        </Link>
    );
}
