import { Type } from "lucide-react";
import { useT } from "@/i18n";
import type { NavPanelProps } from "./NavDropdown";

/** The Text tools panel. Nothing to open yet — it says so, rather than leading anywhere. */
export function TextToolsMenu({ id, open, panelRef, onKeyDown }: NavPanelProps) {
    const t = useT();
    return (
        <div className="pointer-events-none absolute top-full left-1/2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2">
            <div id={id} ref={panelRef} data-open={open || undefined} inert={!open} onKeyDown={onKeyDown} className="nav-panel pt-5">
                <div className="flex items-start gap-3 rounded-2xl border border-secondary bg-primary p-4 shadow-xl">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-secondary bg-secondary text-secondary">
                        <Type className="size-5" strokeWidth={1.9} aria-hidden />
                    </span>
                    <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-primary">
                            {t.nav.textTools}
                            <ComingSoon />
                        </p>
                        <p className="mt-1 text-sm text-tertiary">{t.nav.textToolsSoon}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ComingSoon() {
    const t = useT();
    return <span className="rounded-full bg-[var(--brand-soft)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--brand)]">{t.nav.comingSoon}</span>;
}
