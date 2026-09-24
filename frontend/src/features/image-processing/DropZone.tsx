import { ImagePlus, Lock, Plus, Clipboard } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils/cn";

interface DropZoneProps {
    onChoose: () => void;
    className?: string;
}

/** The empty state for image tools: a large target, the exact limits, and a real image to try. */
export function DropZone({ onChoose, className }: DropZoneProps) {
    const t = useT();
    return (
        <div className={cn("flex size-full min-h-0 flex-col overflow-y-auto", className)}>
            <button type="button" onClick={onChoose} className="dropzone group flex min-h-[13rem] flex-1 cursor-pointer flex-col items-center justify-center px-5 py-6 text-center">
                <span className="relative flex size-16 items-center justify-center rounded-2xl bg-[var(--tool-solid)] text-white shadow-lg transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-translate-y-1">
                    <ImagePlus className="size-7" aria-hidden />
                    <span aria-hidden className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full border-2 border-[var(--studio-stage)] bg-[var(--a-sky-solid)] text-white">
                        <Plus className="size-3.5" />
                    </span>
                </span>

                {/* Touch devices can't drag files in, so they get "choose" wording instead of "drop". */}
                <span className="mt-5 text-tile text-primary [@media(hover:none)]:hidden">
                    {t.upload.dropHere}, {t.upload.orChoose}{" "}
                    <span className="text-[var(--tool)] underline decoration-transparent underline-offset-4 transition-colors group-hover:decoration-current">{t.upload.chooseAFile}</span>
                </span>
                <span className="mt-5 hidden text-tile text-primary [@media(hover:none)]:inline">{t.upload.chooseOnTouch}</span>

                <span className="mt-2 max-w-sm text-sm text-tertiary">{t.common.uploadHint}</span>

                <span className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="fact-chip hue-teal [@media(hover:none)]:hidden">
                        <Clipboard className="size-3" aria-hidden />
                        {t.upload.pasteChip}
                    </span>
                    <span className="fact-chip hue-teal">
                        <Lock className="size-3" aria-hidden />
                        {t.upload.neverStored}
                    </span>
                </span>
            </button>

        </div>
    );
}
