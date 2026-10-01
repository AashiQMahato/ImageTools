import { Link } from "react-router-dom";
import { TOOL_ICONS } from "@/components/layout/toolIcons";
import { ORGANIZE_MODES, type ToolKey } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";
import { useHandoff } from "@/store/useHandoff";
import { useOpenDocuments } from "@/store/useOpenDocuments";
import { useT } from "@/i18n";

/**
 * Organize PDF's modes — merge, split, pages, rotate, compress, view. Each is its own page; moving
 * between them carries the open PDF along, so it feels like one tool.
 */
export function OrganizeModeBar({ current }: { current: ToolKey }) {
    const t = useT();
    const copy = t.documents.organizer;
    return (
        <nav aria-label={copy.modesLabel} className="-mx-1 shrink-0 overflow-x-auto px-1 [scrollbar-width:none]">
            <ul className="flex w-max items-center gap-1">
                {ORGANIZE_MODES.map((mode) => {
                    const Icon = TOOL_ICONS[mode.key];
                    const selected = mode.key === current;
                    return (
                        <li key={mode.key}>
                            <Link
                                to={mode.href}
                                aria-current={selected ? "page" : undefined}
                                onClick={() => {
                                    const files = useOpenDocuments.getState().files;
                                    if (!selected && files.length) useHandoff.getState().send([...files], current);
                                }}
                                className={cn(
                                    "flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap outline-focus-ring transition-[color,background-color,scale] duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 active:scale-[0.96]",
                                    selected ? "bg-secondary text-primary dark:bg-tertiary" : "text-tertiary hover:text-primary",
                                )}
                            >
                                <Icon className="size-4 shrink-0" aria-hidden />
                                {copy.modes[mode.key as keyof typeof copy.modes]}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
