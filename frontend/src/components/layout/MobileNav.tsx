import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Segmented } from "@/components/common/Segmented";
import { UploadButton } from "@/components/common/UploadButton";
import { ROUTES } from "@/lib/constants/routes";
import { SECTION_LINKS, type SectionKey, TOOL_GROUPS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { DICTIONARIES, LOCALES, useLocale, useT } from "@/i18n";
import { NavItem } from "./NavItem";
import { scrollToSection, sectionHref } from "./sections";
import { TOOL_ICONS } from "./toolIcons";

interface MobileNavProps {
    id: string;
    open: boolean;
    onClose: () => void;
    activeSection: SectionKey | null;
}

/**
 * Phones and tablets: a near-full-width sheet under the bar, with Tools as an accordion rather than
 * a squeezed desktop panel. Stays mounted so it can animate out; `inert` keeps it out of reach.
 */
export function MobileNav({ id, open, onClose, activeSection }: MobileNavProps) {
    const t = useT();
    const { pathname } = useLocation();
    const { locale, setLocale } = useLocale();
    const [toolsOpen, setToolsOpen] = useState(false);

    // The page underneath shouldn't scroll while the sheet is up.
    useEffect(() => {
        if (!open) return;
        const root = document.documentElement;
        const previous = root.style.overflow;
        root.style.overflow = "hidden";
        return () => {
            root.style.overflow = previous;
        };
    }, [open]);

    return (
        <>
            <div aria-hidden data-open={open || undefined} onClick={onClose} className="nav-scrim fixed inset-x-0 top-18 bottom-0 bg-overlay/25 lg:hidden" />

            <div id={id} data-open={open || undefined} inert={!open} className="nav-sheet absolute inset-x-0 top-full px-[var(--page-gutter)] pt-2 lg:hidden">
                <nav aria-label={t.nav.main} className="mx-auto max-h-[calc(100dvh-6rem)] max-w-xl overflow-y-auto rounded-2xl border border-secondary bg-primary p-2 shadow-xl">
                    <button
                        type="button"
                        aria-expanded={toolsOpen}
                        aria-controls={`${id}-tools`}
                        onClick={() => setToolsOpen((value) => !value)}
                        className="flex min-h-12 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-md font-medium text-primary transition-colors duration-150 outline-focus-ring hover:bg-primary_hover focus-visible:outline-2"
                    >
                        {t.nav.tools}
                        <Plus className="nav-plus size-5 text-quaternary" aria-hidden />
                    </button>

                    <div id={`${id}-tools`} data-open={toolsOpen || undefined} inert={!toolsOpen} className="nav-accordion">
                        <div>
                            <div className="flex flex-col gap-3 px-1 pt-1 pb-3">
                                {TOOL_GROUPS.map((group) => (
                                    <section key={group.key} aria-labelledby={`${id}-group-${group.key}`}>
                                        <h2 id={`${id}-group-${group.key}`} className="px-2 pb-1 text-label text-quaternary">
                                            {t.nav.groups[group.key]}
                                        </h2>
                                        <ul>
                                            {group.items.map((item) => {
                                                const Icon = TOOL_ICONS[item.key];
                                                const current = !item.alias && pathname === item.href;
                                                return (
                                                    <li key={item.key}>
                                                        <Link
                                                            to={item.href}
                                                            onClick={onClose}
                                                            aria-current={current ? "page" : undefined}
                                                            className={cn(
                                                                "flex min-h-11 items-center gap-3 rounded-lg px-2 text-[0.9375rem] font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2",
                                                                current ? "bg-primary_hover text-primary" : "text-secondary hover:bg-primary_hover hover:text-primary",
                                                            )}
                                                        >
                                                            <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-secondary bg-secondary text-secondary">
                                                                <Icon className="size-[1.125rem]" strokeWidth={1.9} aria-hidden />
                                                            </span>
                                                            {t.nav.toolItems[item.key].title}
                                                        </Link>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </section>
                                ))}
                            </div>
                        </div>
                    </div>

                    <ul>
                        {SECTION_LINKS.map((link) => (
                            <li key={link.key}>
                                <NavItem
                                    size="sheet"
                                    href={sectionHref(link.id)}
                                    active={activeSection === link.key}
                                    onNavigate={() => {
                                        scrollToSection(link.id);
                                        onClose();
                                    }}
                                >
                                    {t.nav[link.key]}
                                </NavItem>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-2 flex flex-col gap-3 border-t border-secondary px-1 pt-3 pb-1">
                        {/* The desktop language dropdown would be clipped inside this scrolling sheet. */}
                        <Segmented
                            label={t.common.language}
                            value={locale}
                            onChange={setLocale}
                            className="w-full [&>button]:flex-1"
                            options={LOCALES.map((code) => ({ value: code, label: DICTIONARIES[code].meta.name }))}
                        />
                        <UploadButton
                            size="lg"
                            label={t.common.startEditing}
                            navigateTo={ROUTES.editor}
                            className="flex w-full md:hidden"
                            buttonClassName="w-full rounded-full before:rounded-full"
                        />
                    </div>
                </nav>
            </div>
        </>
    );
}
