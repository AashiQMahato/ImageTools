import type { AppRoute } from "@/lib/constants/routes";
import data from "./pages.json";

/**
 * Search and sharing metadata for every page, from one file (pages.json) that the app reads here and
 * the build script reads to write each page's HTML — so the tags a crawler sees in the HTML and the
 * ones the app sets while you move around always agree.
 */
export interface PageSeo {
    title: string;
    heading: string;
    description: string;
    /** Another page this one is a version of (e.g. the Text Editor's panels). */
    canonical?: string;
    priority: number;
}

/** Every route has its metadata: a page added without any is a type error here. */
const PAGES: Record<AppRoute, PageSeo> = data.pages;

export const SITE = {
    ...data.site,
    /** The site's address (overridable per deployment). */
    url: (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || data.site.url,
};

export const absoluteUrl = (path: string) => `${SITE.url}${path === "/" ? "/" : path}`;

export function pageSeo(path: string): PageSeo & { path: string } {
    const known = (PAGES as Record<string, PageSeo>)[path];
    return known ? { ...known, path } : { ...PAGES["/"], path: "/" };
}
