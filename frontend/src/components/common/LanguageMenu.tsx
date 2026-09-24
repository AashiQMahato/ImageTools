import { Check, ChevronDown } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { DICTIONARIES, LOCALES, type Locale, useLocale, useT } from "@/i18n";
import { cn } from "@/lib/utils/cn";

/** "EN ⌄" language switcher. The menu grows from its button; arrow keys move, Escape closes. */
export function LanguageMenu({ className }: { className?: string }) {
    const t = useT();
    const locale = useLocale((state) => state.locale);
    const setLocale = useLocale((state) => state.setLocale);
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const button = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) setOpen(false);
        };
        window.addEventListener("pointerdown", onDown);
        // Focus the current language when the menu opens.
        root.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
        return () => window.removeEventListener("pointerdown", onDown);
    }, [open]);

    const choose = (next: Locale) => {
        setLocale(next);
        setOpen(false);
        button.current?.focus();
    };

    const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
        const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])];
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            button.current?.focus();
        } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            items[(index + step + items.length) % items.length]?.focus();
        }
    };

    return (
        <div ref={root} className={cn("relative", className)}>
            <button
                ref={button}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={`${t.common.language}: ${t.meta.name}`}
                onClick={() => setOpen((value) => !value)}
                className={cn(
                    "flex h-9 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150",
                    "outline-focus-ring focus-visible:outline-2",
                    open ? "bg-fg-primary/5 text-primary dark:bg-fg-primary/8" : "text-primary/70 hover:bg-fg-primary/5 hover:text-primary dark:hover:bg-fg-primary/8",
                )}
            >
                {t.meta.short}
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")} aria-hidden />
            </button>

            <div
                role="menu"
                aria-label={t.common.language}
                onKeyDown={onMenuKey}
                className={cn(
                    "absolute top-full right-0 z-50 mt-2 w-44 origin-top-right rounded-xl border border-[var(--card-line)] bg-[var(--card-bg)] p-1.5 shadow-[var(--card-shadow)]",
                    "transition-[opacity,scale] duration-200 ease-[var(--ease-out)]",
                    open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
                )}
            >
                {LOCALES.map((code) => {
                    const dictionary = DICTIONARIES[code];
                    const checked = code === locale;
                    return (
                        <button
                            key={code}
                            type="button"
                            role="menuitemradio"
                            aria-checked={checked}
                            lang={code}
                            tabIndex={open ? 0 : -1}
                            onClick={() => choose(code)}
                            className={cn(
                                "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                                "outline-none focus-visible:bg-fg-primary/5 hover:bg-fg-primary/5",
                                checked ? "font-semibold text-primary" : "text-secondary",
                            )}
                        >
                            <span>
                                {dictionary.meta.name}
                                <span className="ml-2 text-xs font-medium text-quaternary">{code.toUpperCase()}</span>
                            </span>
                            {checked && <Check className="size-4 text-[var(--indigo)]" aria-hidden />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
