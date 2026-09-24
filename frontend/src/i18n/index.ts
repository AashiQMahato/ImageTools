import { useEffect } from "react";
import { create } from "zustand";
import { type Dictionary, en } from "./en";
import { ne } from "./ne";

export type Locale = "en" | "ne";

export const DICTIONARIES: Record<Locale, Dictionary> = { en, ne };
export const LOCALES: Locale[] = ["en", "ne"];

const STORAGE_KEY = "locale";

function initialLocale(): Locale {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved === "en" || saved === "ne") return saved;
    } catch {
        // Storage unavailable: fall back to the browser language.
    }
    return navigator.language?.toLowerCase().startsWith("ne") ? "ne" : "en";
}

interface LocaleState {
    locale: Locale;
    setLocale: (locale: Locale) => void;
}

export const useLocale = create<LocaleState>()((set) => ({
    locale: initialLocale(),
    setLocale: (locale) => {
        try {
            localStorage.setItem(STORAGE_KEY, locale);
        } catch {
            // Not persisted this session; the choice still applies.
        }
        set({ locale });
    },
}));

/** The dictionary for the current language. */
export function useT(): Dictionary {
    return DICTIONARIES[useLocale((state) => state.locale)];
}

/** Keep <html lang> in sync (fonts, screen readers, hyphenation). Mount once. */
export function useDocumentLanguage() {
    const locale = useLocale((state) => state.locale);
    useEffect(() => {
        document.documentElement.lang = locale;
    }, [locale]);
}

export interface AppErrorInfo {
    code?: string;
    /** The server's own (English) message. */
    message?: string;
}

/**
 * The message for an API error in the current language. English keeps the server's wording (it can be more
 * specific, e.g. include a size limit); other languages use the translation for the error code.
 */
export function errorMessage(t: Dictionary, error: AppErrorInfo | null | undefined) {
    if (!error) return "";
    if (t.meta.lang === "en" && error.message) return error.message;
    return (error.code && t.errors[error.code]) || error.message || t.errors.GENERIC!;
}

export type { Dictionary, ToolGuide } from "./en";
