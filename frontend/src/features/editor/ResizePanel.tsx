import { ChevronRight, Link2, Unlink2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";
import { outputSize } from "./geometry";
import type { EditState } from "./render";
import { useT } from "@/i18n";

interface ResizePanelProps {
    edit: EditState;
    onCommit: (next: EditState) => void;
}

const PERCENT_PRESETS = [100, 75, 50, 25];
const EDGE_PRESETS = [3840, 2048, 1080];

/** Output size. Never larger than the cropped pixels — enlarging is what the AI upscaler is for. */
export function ResizePanel({ edit, onCommit }: ResizePanelProps) {
    const t = useT();
    const native = outputSize(edit.crop);
    const current = edit.resize ?? native;
    const [locked, setLocked] = useState(true);
    const [draft, setDraft] = useState({ width: String(current.width), height: String(current.height) });
    const ratio = native.width / native.height;

    const apply = (width: number, height: number) => {
        const w = Math.max(1, Math.min(native.width, Math.round(width)));
        const h = Math.max(1, Math.min(native.height, Math.round(height)));
        onCommit({ ...edit, resize: w === native.width && h === native.height ? null : { width: w, height: h } });
    };

    const onField = (axis: "width" | "height", text: string) => {
        const value = Number(text);
        if (!locked || !Number.isFinite(value) || value <= 0) {
            setDraft((d) => ({ ...d, [axis]: text }));
            return;
        }
        setDraft(axis === "width" ? { width: text, height: String(Math.round(value / ratio)) } : { width: String(Math.round(value * ratio)), height: text });
    };

    const commitDraft = () => {
        const w = Number(draft.width);
        const h = Number(draft.height);
        if (!(w > 0) || !(h > 0)) return setDraft({ width: String(current.width), height: String(current.height) });
        if (locked) {
            const scale = Math.min(1, w / native.width, h / native.height);
            apply(native.width * scale, native.height * scale);
        } else {
            apply(w, h);
        }
    };

    const byLongEdge = (edge: number) => {
        const scale = Math.min(1, edge / Math.max(native.width, native.height));
        apply(native.width * scale, native.height * scale);
    };

    const megapixels = (current.width * current.height) / 1_000_000;
    const field = "w-full rounded-xl bg-[var(--seg-track)] px-3.5 py-2.5 text-md font-semibold tabular-nums text-primary outline-none ring-1 ring-transparent transition-shadow focus:ring-[var(--color-focus-ring)]";

    return (
        <div className="flex flex-col gap-7">
            <div className="flex items-end gap-2">
                <label className="flex-1">
                    <span className="mb-1.5 block text-xs font-medium text-quaternary">{t.editor.resize.width}</span>
                    <input inputMode="numeric" value={draft.width} onChange={(e) => onField("width", e.target.value)} onBlur={commitDraft} onKeyDown={(e) => e.key === "Enter" && commitDraft()} className={field} aria-label={t.editor.resize.widthAria} />
                </label>
                <button
                    type="button"
                    aria-pressed={locked}
                    aria-label={locked ? t.editor.resize.unlock : t.editor.resize.lock}
                    onClick={() => setLocked((value) => !value)}
                    className={cn("mb-1 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors outline-focus-ring focus-visible:outline-2", locked ? "text-primary" : "text-quaternary")}
                >
                    {locked ? <Link2 className="size-5" aria-hidden /> : <Unlink2 className="size-5" aria-hidden />}
                </button>
                <label className="flex-1">
                    <span className="mb-1.5 block text-xs font-medium text-quaternary">{t.editor.resize.height}</span>
                    <input inputMode="numeric" value={draft.height} onChange={(e) => onField("height", e.target.value)} onBlur={commitDraft} onKeyDown={(e) => e.key === "Enter" && commitDraft()} className={field} aria-label={t.editor.resize.heightAria} />
                </label>
            </div>

            <div className="flex flex-col gap-3">
                <h3 className="text-label text-tertiary">{t.editor.resize.scale}</h3>
                <div className="flex flex-wrap gap-2">
                    {PERCENT_PRESETS.map((percent) => {
                        const active = Math.round((current.width / native.width) * 100) === percent;
                        return (
                            <Chip key={percent} active={active} onClick={() => apply(native.width * (percent / 100), native.height * (percent / 100))}>
                                {percent}%
                            </Chip>
                        );
                    })}
                </div>
                <h3 className="mt-3 text-label text-tertiary">{t.editor.resize.longEdge}</h3>
                <div className="flex flex-wrap gap-2">
                    {EDGE_PRESETS.filter((edge) => edge < Math.max(native.width, native.height)).map((edge) => (
                        <Chip key={edge} active={Math.max(current.width, current.height) === edge} onClick={() => byLongEdge(edge)}>
                            {edge.toLocaleString("en-US")} px
                        </Chip>
                    ))}
                    {EDGE_PRESETS.every((edge) => edge >= Math.max(native.width, native.height)) && <p className="text-sm text-tertiary">{t.editor.resize.alreadySmaller}</p>}
                </div>
            </div>

            <div className="rounded-2xl bg-[var(--seg-track)] p-4">
                <p className="text-sm text-tertiary">{t.editor.resize.output}</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-primary tabular-nums">
                    {current.width.toLocaleString("en-US")} × {current.height.toLocaleString("en-US")}
                </p>
                <p className="text-sm text-quaternary tabular-nums">{t.editor.resize.megapixels(megapixels.toFixed(megapixels < 10 ? 1 : 0))}</p>
            </div>

            <Link to={ROUTES.upscale} className="link-accent group inline-flex items-center gap-0.5 self-start text-sm font-medium">
                {t.editor.resize.bigger}
                <ChevronRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
            </Link>
        </div>
    );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className={cn(
                "min-h-9 cursor-pointer rounded-full px-3.5 text-sm font-medium tabular-nums transition-[color,background-color,scale] duration-200 active:scale-95",
                "outline-focus-ring focus-visible:outline-2",
                active ? "bg-brand-solid text-primary_on-brand" : "bg-[var(--seg-track)] text-secondary hover:text-primary",
            )}
        >
            {children}
        </button>
    );
}
