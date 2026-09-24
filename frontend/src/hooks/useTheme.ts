import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
const DARK_CLASS = "dark-mode"; // Untitled UI's dark variant selector

function getInitialTheme(): Theme {
    return document.documentElement.classList.contains(DARK_CLASS) ? "dark" : "light";
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        document.documentElement.classList.toggle(DARK_CLASS, theme === "dark");
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch {
            // Storage can be unavailable (private mode); the theme still applies for this session.
        }
    }, [theme]);

    const toggleTheme = useCallback(() => {
        const next = () => setTheme((current) => (current === "dark" ? "light" : "dark"));
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        // Cross-fade the whole page instead of snapping between light and dark.
        if (!document.startViewTransition || reduceMotion) {
            next();
            return;
        }
        document.startViewTransition(() => flushSync(next));
    }, []);

    return { theme, toggleTheme };
}
