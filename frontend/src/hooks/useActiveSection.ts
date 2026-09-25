import { useEffect, useState } from "react";
import { SECTION_LINKS, type SectionKey } from "@/lib/constants/navigation";

/**
 * Which home-page section is in view, for the navbar's current state. A section counts once it
 * crosses a thin band just above the middle of the viewport — where the eye actually is.
 */
export function useActiveSection(enabled: boolean): SectionKey | null {
    const [active, setActive] = useState<SectionKey | null>(null);

    useEffect(() => {
        if (!enabled) return;
        const targets = SECTION_LINKS.map((link) => ({ link, element: document.getElementById(link.id) })).filter((entry) => entry.element);
        if (targets.length === 0) return;

        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                setActive(SECTION_LINKS.find((link) => visible.has(link.id))?.key ?? null);
            },
            { rootMargin: "-45% 0px -50% 0px" },
        );
        for (const { element } of targets) observer.observe(element!);
        return () => observer.disconnect();
    }, [enabled]);

    // Derived: off the home page there is no current section, whatever was last seen.
    return enabled ? active : null;
}
