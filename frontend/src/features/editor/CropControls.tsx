import { RectangleHorizontal, RectangleVertical, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { cn } from "@/lib/utils/cn";
import type { CropRect } from "./geometry";
import { applyAspect, ASPECTS, aspectRatio, flip, rotateLeft, type SourceSize, straighten } from "./operations";
import type { EditState } from "./render";
import { StraightenDial } from "./StraightenDial";
import { type AspectId, useEditStore } from "./useEditStore";
import { useT } from "@/i18n";

interface CropControlsProps {
    edit: EditState;
    source: SourceSize;
    onPreview: (next: EditState) => void;
    onCommit: (next: EditState) => void;
    onStraighteningChange: (active: boolean) => void;
}

const iconButton = "press-scale rounded-full before:rounded-full";

const sameRect = (a: CropRect, b: CropRect) =>
    Math.abs(a.cx - b.cx) < 0.5 && Math.abs(a.cy - b.cy) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5;

function FlipIcon({ className, vertical }: { className?: string; vertical?: boolean }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={cn(className, vertical && "rotate-90")} aria-hidden>
            <path d="M12 3v18" strokeDasharray="2 2.5" />
            <path d="M16 7l4 5-4 5z" />
            <path d="M8 7l-4 5 4 5z" />
        </svg>
    );
}

/** Straighten dial, aspect ratios, and rotate / flip — grouped beneath the photo they act on. */
export function CropControls({ edit, source, onPreview, onCommit, onStraighteningChange }: CropControlsProps) {
    const t = useT();
    const namedAspect = { free: t.editor.crop.freeform, original: t.editor.crop.original, "1:1": t.editor.crop.square };
    const aspect = useEditStore((state) => state.session?.aspect ?? "free");
    const portrait = useEditStore((state) => state.session?.portrait ?? false);
    const setAspect = useEditStore((state) => state.setAspect);
    const baseCrop = useRef<CropRect | null>(null);
    const [, setDialActive] = useState(false);

    const chooseAspect = (id: AspectId, nextPortrait = portrait) => {
        setAspect(id, nextPortrait);
        const ratio = aspectRatio(id, nextPortrait, edit, source);
        if (ratio) onCommit(applyAspect(edit, source, ratio));
    };

    const orientable = aspect !== "free" && aspect !== "original" && aspect !== "1:1";

    return (
        <div className="flex flex-col items-center gap-5">
            <div className="w-full">
                <StraightenDial
                    value={edit.orientation.angle}
                    onActiveChange={(active) => {
                        if (active) {
                            // Reuse the pre-straighten crop only if nothing else (pan, undo, rotate) changed it since.
                            const base = baseCrop.current;
                            const stillValid = base && sameRect(straighten(edit, source, edit.orientation.angle, base).crop, edit.crop);
                            baseCrop.current = stillValid ? base : edit.crop;
                        }
                        setDialActive(active);
                        onStraighteningChange(active);
                    }}
                    onChange={(angle) => onPreview(straighten(edit, source, angle, baseCrop.current ?? edit.crop))}
                    onCommit={(angle) => {
                        const next = straighten(edit, source, angle, baseCrop.current ?? edit.crop);
                        if (angle === 0) baseCrop.current = null;
                        onCommit(next);
                    }}
                />
            </div>

            <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-3">
                <Segmented
                    label={t.editor.crop.aspect}
                    scrollable
                    value={aspect}
                    onChange={(id) => chooseAspect(id)}
                    options={ASPECTS.map((option) => ({
                        value: option.id,
                        label: option.label === null ? namedAspect[option.id as "free" | "original" | "1:1"] : portrait ? option.label.split(":").reverse().join(":") : option.label,
                    }))}
                />

                <div className="flex items-center gap-1">
                    <Button
                        size="md"
                        color="tertiary"
                        isDisabled={!orientable}
                        aria-label={portrait ? t.editor.crop.landscape : t.editor.crop.portrait}
                        iconLeading={portrait ? RectangleVertical : RectangleHorizontal}
                        onPress={() => chooseAspect(aspect, !portrait)}
                        className={iconButton}
                    />
                    <Button size="md" color="tertiary" aria-label={t.editor.crop.rotateLeft} iconLeading={RotateCcw} onPress={() => onCommit(rotateLeft(edit))} className={iconButton} />
                    <Button size="md" color="tertiary" aria-label={t.editor.crop.flipH} iconLeading={<FlipIcon className="size-5 text-fg-quaternary" />} onPress={() => onCommit(flip(edit, "x"))} className={iconButton} />
                    <Button
                        size="md"
                        color="tertiary"
                        aria-label={t.editor.crop.flipV}
                        iconLeading={<FlipIcon vertical className="size-5 text-fg-quaternary" />}
                        onPress={() => onCommit(flip(edit, "y"))}
                        className={iconButton}
                    />
                </div>
            </div>
        </div>
    );
}
