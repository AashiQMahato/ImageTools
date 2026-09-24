import { Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Logo } from "@/components/common/Logo";
import { UploadButton } from "@/components/common/UploadButton";
import { Button } from "@/components/ui/base/buttons/button";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { PRIMARY_NAV } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function Navbar() {
    const scrolled = useScrolled();
    const { theme, toggleTheme } = useTheme();
    const { pathname } = useLocation();
    // The menu remembers the page it was opened on, so navigating anywhere closes it.
    const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
    const menuOpen = menuOpenedAt === pathname;
    const setMenuOpen = (open: boolean) => setMenuOpenedAt(open ? pathname : null);

    // Close on Escape.
    useEffect(() => {
        if (!menuOpen) return;
        const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpenedAt(null);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [menuOpen]);

    const onDark = useOverDarkSection();
    const elevated = scrolled || menuOpen;
    const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

    return (
        <header
            className={cn(
                "sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-500 ease-[var(--ease-out)]",
                // Over a dark, full-bleed section the bar switches to its dark material, like Apple's.
                onDark && !menuOpen && "dark-mode",
                elevated
                    ? "border-black/[0.06] bg-primary/72 backdrop-blur-xl backdrop-saturate-[1.8] dark:border-white/[0.08] supports-[not(backdrop-filter:blur(1px))]:bg-primary"
                    : "border-transparent bg-transparent",
            )}
        >
            <div className="page-container flex h-14 items-center gap-8">
                <Logo />

                <DesktopNav />

                <div className="ml-auto flex items-center gap-1.5">
                    <Button
                        color="tertiary"
                        size="sm"
                        className="press-scale"
                        iconLeading={theme === "dark" ? Sun : Moon}
                        aria-label={themeLabel}
                        onPress={toggleTheme}
                    />
                    <UploadButton size="sm" label="Upload" showIcon={false} className="ml-1.5 hidden sm:inline-flex" buttonClassName="rounded-full px-4 before:rounded-full" />
                    <Button
                        color="tertiary"
                        size="sm"
                        className="press-scale md:hidden"
                        iconLeading={menuOpen ? X : Menu}
                        aria-label={menuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={menuOpen}
                        aria-controls="mobile-menu"
                        onPress={() => setMenuOpen(!menuOpen)}
                    />
                </div>
            </div>

            <MobileMenu open={menuOpen} />
        </header>
    );
}

/** True while a `[data-nav-dark]` section sits under the navigation bar. */
function useOverDarkSection() {
    const [overDark, setOverDark] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => {
        let frame = 0;
        const update = () => {
            frame = 0;
            const probe = 28; // vertical centre of the bar
            const dark = Array.from(document.querySelectorAll("[data-nav-dark]")).some((element) => {
                const rect = element.getBoundingClientRect();
                return rect.top <= probe && rect.bottom >= probe;
            });
            setOverDark(dark);
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        schedule();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
        };
    }, [pathname]);

    return overDark;
}

/** Links share one highlight that glides to whichever item is hovered, resting on the active route. */
function DesktopNav() {
    const listRef = useRef<HTMLUListElement>(null);
    const [hovered, setHovered] = useState<number | null>(null);
    const [indicator, setIndicator] = useState<{ left: number; width: number; visible: boolean; animate: boolean }>({
        left: 0,
        width: 0,
        visible: false,
        animate: false,
    });
    const { pathname } = useLocation();
    const activeIndex = PRIMARY_NAV.findIndex((item) => pathname.startsWith(item.href));
    const target = hovered ?? (activeIndex >= 0 ? activeIndex : null);

    useLayoutEffect(() => {
        const item = target === null ? null : listRef.current?.children[target];
        if (!(item instanceof HTMLElement)) {
            setIndicator((current) => ({ ...current, visible: false }));
            return;
        }
        setIndicator((current) => ({
            left: item.offsetLeft,
            width: item.offsetWidth,
            visible: true,
            // Slide between items, but appear in place when coming from nothing.
            animate: current.visible,
        }));
    }, [target]);

    return (
        <nav aria-label="Tools" className="hidden md:block">
            <ul ref={listRef} className="relative flex items-center" onPointerLeave={() => setHovered(null)}>
                {PRIMARY_NAV.map((item, index) => (
                    <li key={item.href} onPointerEnter={() => setHovered(index)}>
                        <NavLink
                            to={item.href}
                            onFocus={() => setHovered(index)}
                            onBlur={() => setHovered(null)}
                            className={({ isActive }) =>
                                cn(
                                    "relative z-10 block rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200",
                                    "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                    isActive || hovered === index ? "text-primary" : "text-tertiary",
                                )
                            }
                        >
                            {item.label}
                        </NavLink>
                    </li>
                ))}
                <li
                    aria-hidden
                    className={cn(
                        "pointer-events-none absolute inset-y-0 rounded-full bg-secondary dark:bg-tertiary",
                        indicator.animate && "transition-[left,width,opacity] duration-[600ms] ease-[var(--ease-spring)]",
                        !indicator.animate && "transition-opacity duration-150",
                        indicator.visible ? "opacity-100" : "opacity-0",
                    )}
                    style={{ left: indicator.left, width: indicator.width }}
                />
            </ul>
        </nav>
    );
}

function MobileMenu({ open }: { open: boolean }) {
    return (
        <div
            id="mobile-menu"
            hidden={!open}
            className="border-t border-secondary md:hidden"
        >
            <nav aria-label="Tools" className="page-container animate-enter pt-3 pb-6 [--i:0]">
                <ul className="flex flex-col">
                    {PRIMARY_NAV.map((item) => (
                        <li key={item.href}>
                            <NavLink
                                to={item.href}
                                className={({ isActive }) =>
                                    cn(
                                        "block rounded-lg py-3 text-2xl font-semibold tracking-[-0.02em] outline-focus-ring focus-visible:outline-2",
                                        isActive ? "text-primary" : "text-secondary",
                                    )
                                }
                            >
                                {item.label}
                            </NavLink>
                        </li>
                    ))}
                </ul>
                <UploadButton size="lg" className="mt-4 flex w-full sm:hidden" buttonClassName="rounded-full before:rounded-full" />
            </nav>
        </div>
    );
}
