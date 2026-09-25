import { ArrowRight } from "lucide-react";
import type { KeyboardEvent, Ref } from "react";
import { Link, useLocation } from "react-router-dom";
import { ALL_TOOLS_HREF, type NavToolGroup, TOOL_GROUPS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { TOOL_ICONS } from "./toolIcons";

interface ToolsMegaMenuProps {
    id: string;
    open: boolean;
    panelRef: Ref<HTMLDivElement>;
    onNavigate: () => void;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * The Tools panel: AI tools and the editor on the left, image tools on the right, a way to the full
 * overview underneath. It hangs from the centre of the navigation, and its top padding is a bridge —
 * the pointer can travel from the trigger into the panel without ever leaving it.
 */
export function ToolsMegaMenu({ id, open, panelRef, onNavigate, onKeyDown }: ToolsMegaMenuProps) {
    const t = useT();
    const [ai, image, editor] = TOOL_GROUPS as [NavToolGroup, NavToolGroup, NavToolGroup];

    return (
        // Positioned against the <nav>, so it centres under the whole navigation rather than one item.
        // The positioner never takes the pointer; the panel's own top padding is the hover bridge, and
        // it only becomes hoverable while open — so an invisible panel can't open itself.
        <div className="pointer-events-none absolute top-full left-1/2 w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2">
            <div id={id} ref={panelRef} data-open={open || undefined} inert={!open} onKeyDown={onKeyDown} className="nav-panel pt-5">
                <div className="overflow-hidden rounded-2xl border border-secondary bg-primary shadow-xl">
                    <div className="grid grid-cols-2 gap-x-3 p-3">
                        <div className="flex flex-col gap-4">
                            <Group group={ai} onNavigate={onNavigate} />
                            <Group group={editor} onNavigate={onNavigate} />
                        </div>
                        <Group group={image} onNavigate={onNavigate} />
                    </div>
                    <div className="border-t border-secondary bg-secondary px-3 py-2">
                        <Link
                            to={ALL_TOOLS_HREF}
                            data-nav-item
                            onClick={onNavigate}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-secondary transition-colors duration-150 outline-focus-ring hover:text-primary focus-visible:outline-2"
                        >
                            {t.nav.exploreAll}
                            <ArrowRight className="nav-arrow size-4" aria-hidden />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Group({ group, onNavigate }: { group: NavToolGroup; onNavigate: () => void }) {
    const t = useT();
    const { pathname } = useLocation();
    const headingId = `nav-group-${group.key}`;

    return (
        <section aria-labelledby={headingId}>
            <h2 id={headingId} className="px-2.5 pt-1 pb-1.5 text-label text-quaternary">
                {t.nav.groups[group.key]}
            </h2>
            <ul className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                    const Icon = TOOL_ICONS[item.key];
                    const copy = t.nav.toolItems[item.key];
                    const current = !item.alias && pathname === item.href;
                    return (
                        <li key={item.key}>
                            <Link
                                to={item.href}
                                data-nav-item
                                onClick={onNavigate}
                                aria-current={current ? "page" : undefined}
                                className={cn(
                                    "nav-tool flex items-center gap-3 rounded-xl p-2.5 outline-focus-ring focus-visible:outline-2",
                                    current ? "bg-secondary" : "hover:bg-secondary",
                                )}
                            >
                                <span className="nav-tool-icon grid size-9 shrink-0 place-items-center rounded-lg border border-secondary bg-primary text-secondary">
                                    <Icon className="size-[1.125rem]" strokeWidth={1.9} aria-hidden />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-semibold text-primary">{copy.title}</span>
                                    <span className="mt-0.5 block text-xs leading-4 text-tertiary">{copy.description}</span>
                                </span>
                                <ArrowRight className="nav-tool-arrow size-4 shrink-0 text-quaternary" aria-hidden />
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
