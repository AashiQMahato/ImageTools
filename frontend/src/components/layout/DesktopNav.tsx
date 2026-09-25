import { ChevronDown } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, type PointerEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { SECTION_LINKS, type SectionKey, TOOL_ROUTES } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { NavItem } from "./NavItem";
import { scrollToSection, sectionHref } from "./sections";
import { ToolsMegaMenu } from "./ToolsMegaMenu";

/** Hover intent: long enough that sweeping across the bar doesn't flash the panel open. */
const OPEN_DELAY = 70;
/** Grace period on leave, so crossing from the trigger into the panel never flickers. */
const CLOSE_DELAY = 150;

type Opener = "hover" | "click" | "keyboard";

interface DesktopNavProps {
    activeSection: SectionKey | null;
    className?: string;
}

export function DesktopNav({ activeSection, className }: DesktopNavProps) {
    const t = useT();
    const { pathname } = useLocation();
    const panelId = useId();
    const wrapRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const openedBy = useRef<Opener | null>(null);
    const focusFirst = useRef(false);
    const timers = useRef<{ open?: number; close?: number }>({});

    // Open for the page it was opened on — navigating anywhere closes it without an effect.
    const [openedAt, setOpenedAt] = useState<string | null>(null);
    const open = openedAt === pathname;

    const clearTimers = useCallback(() => {
        window.clearTimeout(timers.current.open);
        window.clearTimeout(timers.current.close);
    }, []);
    const show = useCallback(
        (via: Opener) => {
            clearTimers();
            openedBy.current = via;
            setOpenedAt(pathname);
        },
        [clearTimers, pathname],
    );
    const hide = useCallback(() => {
        clearTimers();
        openedBy.current = null;
        setOpenedAt(null);
    }, [clearTimers]);

    useEffect(() => clearTimers, [clearTimers]);

    // Outside press and Escape — attached only while open, removed with it.
    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: globalThis.PointerEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) hide();
        };
        const onKeyDown = (event: globalThis.KeyboardEvent) => {
            if (event.key !== "Escape") return;
            const focusInside = wrapRef.current?.contains(document.activeElement);
            hide();
            if (focusInside) triggerRef.current?.focus();
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [open, hide]);

    const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>("[data-nav-item]") ?? []);

    // Opened from the keyboard with ↓: move focus in once the panel is interactive.
    useEffect(() => {
        if (!open || !focusFirst.current) return;
        focusFirst.current = false;
        items()[0]?.focus();
    }, [open]);

    const onPointerEnter = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        window.clearTimeout(timers.current.close);
        if (!open) timers.current.open = window.setTimeout(() => show("hover"), OPEN_DELAY);
    };
    const onPointerLeave = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        window.clearTimeout(timers.current.open);
        // A keyboard user's resting mouse shouldn't close what they opened.
        if (openedBy.current !== "keyboard") timers.current.close = window.setTimeout(hide, CLOSE_DELAY);
    };
    const onBlur = (event: FocusEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hide();
    };

    const onTriggerClick = () => {
        // Hovered open, then clicked: the click confirms rather than closes.
        if (open && openedBy.current === "hover") {
            openedBy.current = "click";
            return;
        }
        if (open) hide();
        else show("click");
    };
    const onTriggerKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "ArrowDown") return;
        event.preventDefault();
        if (open) items()[0]?.focus();
        else {
            focusFirst.current = true;
            show("keyboard");
        }
    };
    const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLElement);
        const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: list.length - 1 }[event.key];
        if (next === undefined || list.length === 0) return;
        event.preventDefault();
        list[(next + list.length) % list.length]?.focus();
    };

    const toolsCurrent = (TOOL_ROUTES as readonly string[]).includes(pathname);

    return (
        <nav aria-label={t.nav.main} className={cn("relative", className)}>
            <ul className="flex items-center gap-1">
                <li>
                    <div ref={wrapRef} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}>
                        <button
                            ref={triggerRef}
                            type="button"
                            aria-expanded={open}
                            aria-haspopup="true"
                            aria-controls={panelId}
                            onClick={onTriggerClick}
                            onKeyDown={onTriggerKeyDown}
                            className={cn(
                                "flex h-9 cursor-pointer items-center gap-1 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                                "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                open || toolsCurrent ? "bg-primary_hover text-primary" : "text-secondary hover:bg-primary_hover hover:text-primary",
                            )}
                        >
                            {t.nav.tools}
                            <ChevronDown className="nav-chevron size-4 text-quaternary" aria-hidden />
                        </button>
                        <ToolsMegaMenu id={panelId} open={open} panelRef={panelRef} onNavigate={hide} onKeyDown={onPanelKeyDown} />
                    </div>
                </li>
                {SECTION_LINKS.map((link) => (
                    <li key={link.key}>
                        <NavItem href={sectionHref(link.id)} active={activeSection === link.key} onNavigate={() => scrollToSection(link.id)}>
                            {t.nav[link.key]}
                        </NavItem>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
