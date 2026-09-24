import type { Dictionary } from "@/i18n";
import { type AppRoute, ROUTES } from "./routes";

type NavKey = keyof Dictionary["nav"];

export interface NavItem {
    /** Short label (navbar). */
    label: NavKey;
    /** Full label (footer, menus). */
    fullLabel: NavKey;
    href: AppRoute;
}

export const PRIMARY_NAV: readonly NavItem[] = [
    { label: "removeBgShort", fullLabel: "removeBg", href: ROUTES.removeBackground },
    { label: "upscale", fullLabel: "upscaler", href: ROUTES.upscale },
    { label: "crop", fullLabel: "crop", href: ROUTES.crop },
    { label: "editor", fullLabel: "editor", href: ROUTES.editor },
];
