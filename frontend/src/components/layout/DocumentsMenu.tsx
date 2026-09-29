import { DOCUMENT_GROUPS } from "@/lib/constants/navigation";
import type { NavPanelProps } from "./NavDropdown";
import { Group } from "./ToolsMegaMenu";

/** The Documents panel: text tools; organizing and converting PDFs; editing, signing and securing them. */
export function DocumentsMenu({ id, open, panelRef, onNavigate, onKeyDown }: NavPanelProps) {
    const [text, pdf, convert, edit] = DOCUMENT_GROUPS;
    return (
        <div className="pointer-events-none absolute top-full left-1/2 w-[min(58rem,calc(100vw-2rem))] -translate-x-1/2">
            <div id={id} ref={panelRef} data-open={open || undefined} inert={!open} onKeyDown={onKeyDown} className="nav-panel pt-5">
                <div className="grid grid-cols-3 gap-x-3 rounded-2xl border border-secondary bg-primary p-3 shadow-xl">
                    <Group group={text!} onNavigate={onNavigate} />
                    <div className="flex flex-col gap-4">
                        <Group group={pdf!} onNavigate={onNavigate} />
                        <Group group={convert!} onNavigate={onNavigate} />
                    </div>
                    <Group group={edit!} onNavigate={onNavigate} />
                </div>
            </div>
        </div>
    );
}
