import logo128 from "@/assets/brand/logo-128.png";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

/** The brand mark (transparent PNG, sharp up to 64 px on 2× screens). */
export function LogoMark({ className }: { className?: string }) {
    return <img src={logo128} alt="" aria-hidden width={128} height={128} draggable={false} className={cn("size-7 shrink-0 select-none", className)} />;
}

export function Logo({ className }: { className?: string }) {
    const t = useT();
    return (
        <Link
            to={ROUTES.home}
            aria-label={t.common.homeAria}
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
