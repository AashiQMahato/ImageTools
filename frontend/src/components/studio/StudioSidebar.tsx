import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { TOOL_ICONS } from "@/components/layout/toolIcons";
import { STUDIO_TOOL_GROUPS, type ToolKey } from "@/lib/constants/navigation";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";

/**
 * Every tool, grouped the way the landing page groups them. Wide screens show each tool's name and
 * what it does; at laptop width it folds into an icon rail. The image travels with you between tools.
 */
export function StudioSidebar({ current }: { current: ToolKey }) {
    const t = useT();
    const copy = t.studio;

    return (
        <nav aria-label={copy.toolsNav} className="hidden shrink-0 flex-col rounded-2xl border border-[var(--card-line)] bg-primary p-2 lg:flex lg:w-[4.25rem] xl:w-64 xl:p-3">
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
                {STUDIO_TOOL_GROUPS.map((group) => (
                    <section key={group.key} aria-labelledby={`studio-group-${group.key}`} className="flex flex-col gap-1">
                        <h2 id={`studio-group-${group.key}`} className="px-2 pb-1 text-[0.6875rem] font-semibold tracking-[0.06em] text-quaternary uppercase lg:sr-only xl:not-sr-only">
                            {t.nav.groups[group.key]}
                        </h2>
                        {group.items.map((item) => {
                            const Icon = TOOL_ICONS[item.key];
                            const active = !item.alias && item.key === current;
                            const { title, description } = t.nav.toolItems[item.key];
                            return (
                                <Link
                                    key={item.key}
                                    to={item.href}
                                    aria-current={active ? "page" : undefined}
                                    title={title}
                                    className={cn(
                                        "group relative flex items-center gap-3 rounded-xl p-1.5 outline-focus-ring transition-colors duration-150 focus-visible:outline-2 lg:justify-center xl:justify-start xl:pr-2",
                                        active ? "bg-[var(--brand-soft)]" : "hover:bg-secondary",
                                    )}
                                >
                                    {/* The active tool is marked by an indicator on the edge, not just a colour. */}
                                    {active && <span aria-hidden className="absolute top-2 bottom-2 -left-2 w-1 rounded-r-full bg-[var(--brand)] xl:-left-3" />}
                                    <span
                                        className={cn(
                                            "grid size-9 shrink-0 place-items-center rounded-lg transition-colors duration-150",
                                            active ? "bg-brand-solid text-white" : "bg-secondary text-tertiary group-hover:text-primary",
                                        )}
                                    >
                                        <Icon className="size-[1.125rem]" strokeWidth={1.9} aria-hidden />
                                    </span>
                                    <span className="min-w-0 lg:sr-only xl:not-sr-only">
                                        <span className={cn("block truncate text-sm font-semibold", active ? "text-[var(--brand)]" : "text-primary")}>{title}</span>
                                        <span className="block truncate text-xs text-tertiary">{description}</span>
                                    </span>
                                </Link>
                            );
                        })}
                    </section>
                ))}
            </div>

            <div className="mt-3 flex flex-col gap-2 border-t border-[var(--card-line)] pt-3">
                <div className="hidden items-start gap-2.5 rounded-xl bg-secondary p-3 xl:flex">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success-primary" aria-hidden />
                    <p className="text-xs leading-relaxed text-tertiary">
                        <span className="block font-semibold text-secondary">{copy.privateTitle}</span>
                        {copy.privateNote}
                    </p>
                </div>
                <Link
                    to={ROUTES.home}
                    title={copy.backHome}
                    className="flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-tertiary outline-focus-ring hover:bg-secondary hover:text-primary focus-visible:outline-2 lg:justify-center xl:justify-start"
                >
                    <ArrowLeft className="size-4 shrink-0" aria-hidden />
                    <span className="lg:sr-only xl:not-sr-only">{copy.backHome}</span>
                </Link>
            </div>
        </nav>
    );
}
