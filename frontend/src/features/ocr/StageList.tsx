import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { type JobStage, STAGES, type StageState } from "./useOcrJob";

/** The reading as it happens: each stage ticked off when the server reports it — nothing timed or simulated. */
export function StageList({ stages, startedAt, onCancel }: { stages: Record<JobStage, StageState>; startedAt: number | null; onCancel: () => void }) {
    const t = useT();
    const copy = t.ocr;
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!startedAt) return;
        const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [startedAt]);
    const reading = stages.read.status === "active";

    return (
        <section aria-live="polite" className="flex flex-col rounded-xl border border-[var(--card-line)] bg-primary p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-primary">{copy.stagesTitle}</h3>
                <span className="flex items-center gap-1">
                    {elapsed >= 3 && <span className="text-xs text-quaternary tabular-nums">{elapsed}s</span>}
                    <button type="button" onClick={onCancel} aria-label={t.common.cancel} title={t.common.cancel} className="grid size-8 cursor-pointer place-items-center rounded-lg text-tertiary outline-focus-ring hover:bg-primary_hover hover:text-primary focus-visible:outline-2 pointer-coarse:size-10">
                        <X className="size-4" aria-hidden />
                    </button>
                </span>
            </div>
            <ol className="mt-2 flex flex-col gap-0.5">
                {STAGES.map((stage) => (
                    <StageRow key={stage} stage={stage} state={stages[stage]} />
                ))}
            </ol>
            {reading && elapsed >= 12 && <p className="retouch-fade-in mt-2 border-t border-[var(--card-line)] pt-2 text-xs text-tertiary">{copy.firstRun}</p>}
        </section>
    );
}

function StageRow({ stage, state }: { stage: JobStage; state: StageState }) {
    const copy = useT().ocr;
    const { status, detail } = state;
    const notes: string[] = [];
    if (status === "done" && detail) {
        if (stage === "prepare") {
            if (detail.converted && typeof detail.sourceFormat === "string") notes.push(copy.stageNotes.converted(detail.sourceFormat === "heif" ? "HEIC" : detail.sourceFormat.toUpperCase()));
            if (detail.rotated || (typeof detail.turned === "number" && detail.turned > 0)) notes.push(copy.stageNotes.rotated);
            if (detail.enhancedContrast) notes.push(copy.stageNotes.contrast);
            if (typeof detail.resized === "number" && detail.resized > 1) notes.push(copy.stageNotes.enlarged);
        }
        if (stage === "read" && typeof detail.lines === "number") notes.push(copy.stageNotes.lines(detail.lines));
        if (stage === "layout" && typeof detail.blocks === "number") notes.push(copy.stageNotes.blocks(detail.blocks));
    }
    return (
        <li className={cn("flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-sm transition-colors duration-300", status === "active" && "bg-[var(--brand-soft)]")}>
            <span className="grid size-5 shrink-0 place-items-center">
                {status === "done" ? (
                    <span className="retouch-fade-in grid size-5 place-items-center rounded-full bg-success-solid text-white">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                    </span>
                ) : status === "active" ? (
                    <LoaderCircle className="size-4 animate-spin text-[var(--brand)] motion-reduce:animate-none" aria-hidden />
                ) : (
                    <span className="size-2 rounded-full bg-[var(--card-line)]" aria-hidden />
                )}
            </span>
            <span className="min-w-0">
                <span className={cn("block", status === "pending" ? "text-quaternary" : status === "active" ? "font-medium text-primary" : "text-secondary")}>{copy.stages[stage]}</span>
                {notes.length > 0 && <span className="retouch-fade-in block text-xs text-tertiary">{notes.join(" · ")}</span>}
            </span>
        </li>
    );
}
