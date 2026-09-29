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
export type ToolKey = "removeBackground" | "upscaler" | "retouch" | "photoGenerator" | "watermarkRemover" | "compressor" | "crop" | "resize" | "rotateFlip" | "editor" | "ocr" | DocumentToolKey;
export type DocumentToolKey = "pdfMerge" | "pdfSplit" | "pdfOrganize" | "pdfRotate" | "pdfToImages" | "imagesToPdf";
export type ToolGroupKey = "ai" | "image" | "editor" | "text" | "pdf";

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
            { key: "retouch", href: ROUTES.retouch },
            { key: "photoGenerator", href: ROUTES.photoGenerator },
            { key: "watermarkRemover", href: ROUTES.watermarkRemover },
        ],
    },
    {
        key: "image",
        items: [
            { key: "crop", href: ROUTES.crop },
            { key: "compressor", href: ROUTES.compress },
            { key: "resize", href: ROUTES.editor, alias: true },
            { key: "rotateFlip", href: ROUTES.crop, alias: true },
        ],
    },
    { key: "editor", items: [{ key: "editor", href: ROUTES.editor }] },
];

/** The Documents menu: text tools and PDF tools. */
export const DOCUMENT_GROUPS: readonly NavToolGroup[] = [
    { key: "text", items: [{ key: "ocr", href: ROUTES.ocr }] },
    {
        key: "pdf",
        items: [
            { key: "pdfMerge", href: ROUTES.pdfMerge },
            { key: "pdfSplit", href: ROUTES.pdfSplit },
            { key: "pdfOrganize", href: ROUTES.pdfOrganize },
            { key: "pdfRotate", href: ROUTES.pdfRotate },
            { key: "pdfToImages", href: ROUTES.pdfToImages },
            { key: "imagesToPdf", href: ROUTES.imagesToPdf },
        ],
    },
];
export const DOCUMENT_ROUTES: readonly AppRoute[] = [ROUTES.documents, ...DOCUMENT_GROUPS.flatMap((group) => group.items.map((item) => item.href))];

/** Every route the Tools menu covers — the trigger reads as current on any of them. */
export const TOOL_ROUTES: readonly AppRoute[] = [ROUTES.removeBackground, ROUTES.upscale, ROUTES.retouch, ROUTES.photoGenerator, ROUTES.watermarkRemover, ROUTES.crop, ROUTES.compress, ROUTES.editor];

/** In-page sections of the home page. There is no About section or page, so there is no About link. */
export const SECTION_LINKS = [
    { key: "howItWorks", id: "how-it-works" },
    { key: "features", id: "features" },
] as const;

export type SectionKey = (typeof SECTION_LINKS)[number]["key"];

/**
 * The studio's own list: one entry per page. Resize and Rotate & Flip are shortcuts into the editor
 * and the crop tool (useful as landing-page entry points), so inside the studio they'd only repeat.
 */
const IMAGE_STUDIO_GROUPS: readonly NavToolGroup[] = TOOL_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => !item.alias) })).filter((group) => group.items.length > 0);

/** Image tools and text tools are separate sections: inside one, the studio lists only that section's tools. */
export const studioToolGroups = (tool: ToolKey): readonly NavToolGroup[] => (DOCUMENT_GROUPS.some((group) => group.items.some((item) => item.key === tool)) ? DOCUMENT_GROUPS : IMAGE_STUDIO_GROUPS);
