import { ROUTES } from "@/lib/constants/routes";

export const sectionHref = (id: string) => `${ROUTES.home}#${id}`;

/**
 * Following a link to the hash you're already on changes nothing, so the router has no reason to
 * scroll. In that one case, scroll here; every other case is AppLayout's hash handling.
 */
export function scrollToSection(id: string) {
    if (window.location.pathname !== ROUTES.home || window.location.hash !== `#${id}`) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
}
