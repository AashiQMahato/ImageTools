import type { Dictionary } from "@/i18n";
import { type AppRoute, ROUTES } from "./routes";

type Nav = Dictionary["nav"];
/** Only the plain-string labels — `nav` also holds the menu's grouped copy. */
type NavKey = { [K in keyof Nav]: Nav[K] extends string ? K : never }[keyof Nav];

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

/* ------------------------------------------------------------------ Navbar
 * One source for the desktop mega menu and the mobile accordion. Every entry points at a route that
 * exists: Resize has no page of its own, so it opens the editor (where the resize panel lives), and
 * Rotate & Flip opens the crop tool, whose controls rotate, flip and straighten.
 */
export type ToolKey = "removeBackground" | "upscaler" | "crop" | "resize" | "rotateFlip" | "editor";
export type ToolGroupKey = "ai" | "image" | "editor";

export interface NavTool {
    key: ToolKey;
    href: AppRoute;
    /** Opens another tool's page, so it never reads as the current page itself. */
    alias?: true;
}

export interface NavToolGroup {
    key: ToolGroupKey;
    items: readonly NavTool[];
}

export const TOOL_GROUPS: readonly NavToolGroup[] = [
    {
        key: "ai",
        items: [
            { key: "removeBackground", href: ROUTES.removeBackground },
            { key: "upscaler", href: ROUTES.upscale },
        ],
    },
    {
        key: "image",
        items: [
            { key: "crop", href: ROUTES.crop },
            { key: "resize", href: ROUTES.editor, alias: true },
            { key: "rotateFlip", href: ROUTES.crop, alias: true },
        ],
    },
    { key: "editor", items: [{ key: "editor", href: ROUTES.editor }] },
];

/** Every route the Tools menu covers — the trigger reads as current on any of them. */
export const TOOL_ROUTES: readonly AppRoute[] = [ROUTES.removeBackground, ROUTES.upscale, ROUTES.crop, ROUTES.editor];

/** In-page sections of the home page. There is no About section or page, so there is no About link. */
export const SECTION_LINKS = [
    { key: "howItWorks", id: "how-it-works" },
    { key: "features", id: "features" },
] as const;

export type SectionKey = (typeof SECTION_LINKS)[number]["key"];

/** Where "Explore all tools" leads: the tools overview on the home page. */
export const ALL_TOOLS_HREF = `${ROUTES.home}#tools`;
