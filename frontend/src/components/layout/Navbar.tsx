import { Menu, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { LanguageMenu } from "@/components/common/LanguageMenu";
import { Logo } from "@/components/common/Logo";
import { UploadButton } from "@/components/common/UploadButton";
import { useActiveSection } from "@/hooks/useActiveSection";
import { useScrolled } from "@/hooks/useScrolled";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

const DESKTOP = "(min-width: 64rem)";
const MOBILE_NAV_ID = "mobile-nav";

/**
 * Transparent over the hero, so the page's first view is one surface; once content scrolls under
 * it, a solid bar with a hairline and a whisper of shadow. Desktop from 1024px; below that the
 * links move into a sheet and the bar keeps only what's used constantly.
 */
export function Navbar() {
    const t = useT();
    const scrolled = useScrolled();
    const { pathname } = useLocation();
    const activeSection = useActiveSection(pathname === ROUTES.home);
    const menuButtonRef = useRef<HTMLButtonElement>(null);

    // The sheet belongs to the page it was opened on, so any navigation closes it.
    const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
    const menuOpen = menuOpenedAt === pathname;
    const closeMenu = useCallback(() => setMenuOpenedAt(null), []);

    // Escape closes the sheet; growing into the desktop layout does too (the sheet has no place there).
    useEffect(() => {
        if (!menuOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            closeMenu();
            menuButtonRef.current?.focus();
        };
        const desktop = window.matchMedia(DESKTOP);
        const onResize = () => desktop.matches && closeMenu();
        document.addEventListener("keydown", onKeyDown);
        desktop.addEventListener("change", onResize);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            desktop.removeEventListener("change", onResize);
        };
    }, [menuOpen, closeMenu]);

    const elevated = scrolled || menuOpen;

    return (
        <header className={cn("nav-bar sticky top-0 z-40 border-b", elevated ? "border-secondary bg-primary shadow-xs" : "border-transparent bg-transparent")}>
            <div className="page-container relative flex h-18 items-center gap-6">
                <Logo className="nav-logo" />

                <DesktopNav activeSection={activeSection} className="absolute left-1/2 hidden -translate-x-1/2 lg:block" />

                <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
                    <LanguageMenu className="hidden lg:block" />
                    <ThemeToggle />
                    <UploadButton
                        size="md"
                        label={t.common.startEditing}
                        navigateTo={ROUTES.editor}
                        showIcon={false}
                        className="ml-1 hidden md:inline-flex"
                        buttonClassName="nav-cta rounded-full px-5 before:rounded-full"
                    />
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-label={menuOpen ? t.common.closeMenu : t.common.openMenu}
                        aria-expanded={menuOpen}
                        aria-controls={MOBILE_NAV_ID}
                        onClick={() => setMenuOpenedAt(menuOpen ? null : pathname)}
                        className="grid size-11 cursor-pointer place-items-center rounded-full text-secondary transition-colors duration-150 outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 lg:hidden"
                    >
                        {menuOpen ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
                    </button>
                </div>
            </div>

            <MobileNav id={MOBILE_NAV_ID} open={menuOpen} onClose={closeMenu} activeSection={activeSection} />
        </header>
    );
}
