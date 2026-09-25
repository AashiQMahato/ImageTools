import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

/**
 * Light / dark switch on the existing theme hook. Render it once: `useTheme` keeps its state per
 * instance, so two copies would disagree about which icon to show.
 */
export function ThemeToggle({ className }: { className?: string }) {
    const t = useT();
    const { theme, toggleTheme } = useTheme();
    const dark = theme === "dark";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? t.common.switchToLight : t.common.switchToDark}
            className={cn(
                "grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-secondary transition-colors duration-150 hover:bg-primary_hover hover:text-primary lg:size-10",
                "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                className,
            )}
        >
            <Sun className="theme-icon col-start-1 row-start-1 size-[1.125rem]" data-shown={dark || undefined} aria-hidden />
            <Moon className="theme-icon col-start-1 row-start-1 size-[1.125rem]" data-shown={!dark || undefined} aria-hidden />
        </button>
    );
}
