import { DOCUMENT_GROUPS } from "@/lib/constants/navigation";
import type { NavPanelProps } from "./NavDropdown";
import { Group } from "./ToolsMegaMenu";

/** The Documents panel: text tools and converting on the left, organizing PDFs on the right. */
export function DocumentsMenu({ id, open, panelRef, onNavigate, onKeyDown }: NavPanelProps) {
    const [text, pdf, convert] = DOCUMENT_GROUPS;
    return (
        <div className="pointer-events-none absolute top-full left-1/2 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2">
            <div id={id} ref={panelRef} data-open={open || undefined} inert={!open} onKeyDown={onKeyDown} className="nav-panel pt-5">
                <div className="grid grid-cols-2 gap-x-3 rounded-2xl border border-secondary bg-primary p-3 shadow-xl">
                    <div className="flex flex-col gap-4">
                        <Group group={text!} onNavigate={onNavigate} />
                        <Group group={convert!} onNavigate={onNavigate} />
                    </div>
                    <Group group={pdf!} onNavigate={onNavigate} />
                </div>
            </div>
        </div>
    );
}
