import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";

/** How long "Analyzing image" shows before the second stage; the last waits for the real result. */
const FIRST_STAGE_MS = 900;

/**
 * While detection runs: a band of light passes over the image (which stays fully visible) and the
 * words say what's happening. No progress numbers — the server doesn't report any.
 */
export function AnalyzingOverlay() {
    const t = useT();
    const stages = t.watermark.analyzing;
    const [stage, setStage] = useState(0);
    useEffect(() => {
        const timer = window.setTimeout(() => setStage(1), FIRST_STAGE_MS);
        return () => window.clearTimeout(timer);
    }, []);
    return (
        <div className="retouch-fade-in pointer-events-none absolute inset-0 overflow-hidden">
            <span aria-hidden className="pg-scan absolute inset-y-0 w-32 -translate-x-1/2" />
            <div role="status" className="absolute bottom-4 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-neutral-950/70 px-3.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-md">
                <LoaderCircle className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
                <span key={stage} className="retouch-stage truncate">
                    {stages[stage]}
                </span>
            </div>
        </div>
    );
}
