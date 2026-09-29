import { useId } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { parsePageRanges, rangeMessage } from "./pageRanges";

/** Page ranges typed as text ("1-3, 5, 7-10"), checked as you type against the document's pages. */
export function PageRangeInput({ value, onChange, count, label, hint }: { value: string; onChange: (value: string) => void; count: number; label: string; hint?: string }) {
    const t = useT();
    const id = useId();
    const parsed = value.trim() ? parsePageRanges(value, count) : null;
    const error = parsed && !parsed.ok ? rangeMessage(t, parsed.problem) : null;
    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-medium text-secondary">
                {label}
            </label>
            <input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={t.documents.ranges.placeholder}
                inputMode="numeric"
                aria-invalid={Boolean(error)}
                aria-describedby={`${id}-note`}
                className={cn(
                    "h-10 rounded-lg border bg-primary px-3 text-sm text-primary tabular-nums outline-focus-ring placeholder:text-quaternary focus-visible:outline-2 pointer-coarse:h-11",
                    error ? "border-error_subtle" : "border-[var(--card-line)]",
                )}
            />
            <p id={`${id}-note`} className={cn("text-xs", error ? "text-error-primary" : "text-tertiary")}>
                {error ?? (parsed?.ok ? t.documents.ranges.selected(parsed.pages.length) : (hint ?? t.documents.ranges.hint(count)))}
            </p>
        </div>
    );
}
