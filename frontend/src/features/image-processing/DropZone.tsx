import { ImagePlus } from "lucide-react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils/cn";

/** The empty state for image tools: a large target to drop or choose an image. */
export function DropZone({ onChoose, className }: { onChoose: () => void; className?: string }) {
    const t = useT();
    return (
        <button
            type="button"
            onClick={onChoose}
            className={cn(
                "group flex size-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/70 px-6 text-center",
                "transition-[border-color,background-color] duration-300 hover:border-[var(--color-focus-ring)] hover:bg-[var(--studio-chrome)]/50",
                "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-4",
                className,
            )}
        >
            <span className="flex size-16 items-center justify-center rounded-2xl bg-[var(--studio-chrome)] text-fg-primary shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-translate-y-1">
                <ImagePlus className="size-7" aria-hidden />
            </span>
            {/* Touch devices can't drag files in, so they get "choose" wording instead of "drop". */}
            <span className="mt-6 text-tile text-primary [@media(hover:none)]:hidden">{t.upload.dropHere}</span>
            <span className="mt-6 hidden text-tile text-primary [@media(hover:none)]:inline">{t.upload.chooseOnTouch}</span>
            <span className="mt-2 text-md text-tertiary [@media(hover:none)]:hidden">
                {t.upload.orChoose} <span className="font-medium text-[var(--accent)]">{t.upload.chooseAFile}</span> · {t.upload.canPaste}
            </span>
            <span className="mt-2 hidden text-md text-tertiary [@media(hover:none)]:inline">{t.upload.fromPhotos}</span>
            <span className="mt-6 text-sm text-quaternary">{t.common.uploadHint}</span>
        </button>
    );
}

