import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Where the work currently stands. Tone is paired with a word every time — colour alone is not a
 * signal, and the dot only pulses while something is genuinely in flight.
 */
export type RailTone = "idle" | "active" | "busy" | "done" | "error" | "warning";

const TONES: Record<RailTone, string> = {
    idle: "text-quaternary",
    active: "text-[var(--tool)]",
    busy: "text-[var(--tool)]",
    done: "text-success-primary",
    error: "text-error-primary",
    warning: "text-warning-primary",
};

interface StatusRailProps {
    tone: RailTone;
    label: string;
    /** The tool's own numbers (input size, target size, format). */
    specs?: ReactNode;
    /** What happens to the image — different for server tools and in-browser ones, so it's passed in. */
    privacy: string;
}

/** A thin instrument rail above the stage: state, the tool's numbers, then the privacy promise. */
export function StatusRail({ tone, label, specs, privacy }: StatusRailProps) {
    return (
        <div className="status-rail">
            <span className={cn("flex items-center gap-2 font-medium", TONES[tone])}>
                <span aria-hidden className={cn("status-dot", tone === "busy" && "status-dot-live")} />
                {label}
            </span>
            {specs && <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-quaternary tabular-nums">{specs}</span>}
            <span className="ml-auto flex items-center gap-1.5 text-quaternary">
                <Lock className="size-3 shrink-0" aria-hidden />
                {privacy}
            </span>
        </div>
    );
}
