import { TEXT_TOOL_GROUP } from "@/lib/constants/navigation";
import type { NavPanelProps } from "./NavDropdown";
import { Group } from "./ToolsMegaMenu";

/** The Text Tools panel: the tools that work with the text in an image. */
export function TextToolsMenu({ id, open, panelRef, onNavigate, onKeyDown }: NavPanelProps) {
    return (
        <div className="pointer-events-none absolute top-full left-1/2 w-[min(21rem,calc(100vw-2rem))] -translate-x-1/2">
            <div id={id} ref={panelRef} data-open={open || undefined} inert={!open} onKeyDown={onKeyDown} className="nav-panel pt-5">
                <div className="rounded-2xl border border-secondary bg-primary p-3 shadow-xl">
                    <Group group={TEXT_TOOL_GROUP} onNavigate={onNavigate} />
                </div>
            </div>
        </div>
    );
}
