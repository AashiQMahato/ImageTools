import { Check, ImageUp, Pipette, Ban } from "lucide-react";
import { type ChangeEvent, type CSSProperties, type ReactNode, useId, useRef, useState } from "react";
import { images } from "@/assets/images/landing";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/constants/upload";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { type Background, SWATCHES } from "./background";

/** The bundled CC0 photographs, reused here as ready-made scenes (see CREDITS.md). */
const SCENES = [
    { id: "kingfisher", url: images.kingfisher.src },
    { id: "heron", url: images.heron.src },
    { id: "flamingo", url: images.flamingo.src },
    { id: "goose", url: images.goose.src },
] as const;

interface BackgroundPickerProps {
    value: Background;
    onChange: (background: Background) => void;
}

/**
 * Replaces what sits behind the subject: nothing, a colour, one of the bundled scenes, or a photo
 * of your own. Every option composites on this device — no second round trip to the server.
 */
export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
    const t = useT();
    const colourInputId = useId();
    const fileRef = useRef<HTMLInputElement>(null);
    /** Object URL for a background the user supplied, kept until they pick a different one. */
    const [uploaded, setUploaded] = useState<{ id: string; url: string } | null>(null);

    const isColour = (hex: string) => value.kind === "colour" && value.value.toLowerCase() === hex.toLowerCase();
    const isImage = (id: string) => value.kind === "image" && value.id === id;

    const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (uploaded) URL.revokeObjectURL(uploaded.url);
        const next = { id: `upload-${crypto.randomUUID()}`, url: URL.createObjectURL(file) };
        setUploaded(next);
        onChange({ kind: "image", url: next.url, id: next.id });
    };

    return (
        <section aria-label={t.pages.removeBackground.backgroundLabel}>
            <h3 className="text-label text-quaternary">{t.pages.removeBackground.backgroundLabel}</h3>

            <div role="radiogroup" aria-label={t.pages.removeBackground.colourLabel} className="mt-2 flex flex-wrap gap-1.5">
                <Swatch
                    selected={value.kind === "transparent"}
                    label={t.pages.removeBackground.noBackground}
                    onSelect={() => onChange({ kind: "transparent" })}
                    className="bg-checkerboard"
                >
                    <Ban className="size-3.5 text-tertiary" aria-hidden />
                </Swatch>

                {SWATCHES.map((swatch) => (
                    <Swatch
                        key={swatch.key}
                        selected={isColour(swatch.value)}
                        label={t.pages.removeBackground.colours[swatch.key]}
                        onSelect={() => onChange({ kind: "colour", value: swatch.value })}
                        style={{ backgroundColor: swatch.value }}
                        tick={swatch.key === "white" || swatch.key === "grey" ? "dark" : "light"}
                    />
                ))}

                {/* Native colour input: the platform's own picker, with the current value as its swatch. */}
                <label
                    htmlFor={colourInputId}
                    title={t.pages.removeBackground.customColour}
                    className={cn(
                        "relative grid size-8 cursor-pointer place-items-center rounded-lg border transition-[border-color,scale] duration-200 active:scale-95",
                        value.kind === "colour" && !SWATCHES.some((s) => isColour(s.value)) ? "border-[var(--tool)] ring-2 ring-[var(--tool)]" : "border-[var(--card-line)]",
                    )}
                    style={value.kind === "colour" ? { backgroundColor: value.value } : undefined}
                >
                    <Pipette className="size-3.5 text-tertiary mix-blend-difference" aria-hidden />
                    <span className="sr-only">{t.pages.removeBackground.customColour}</span>
                    <input
                        id={colourInputId}
                        type="color"
                        value={value.kind === "colour" ? value.value : "#0369a1"}
                        onChange={(event) => onChange({ kind: "colour", value: event.target.value })}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                </label>
            </div>

            <h3 className="mt-5 text-label text-quaternary">{t.pages.removeBackground.sceneLabel}</h3>
            <div role="radiogroup" aria-label={t.pages.removeBackground.sceneLabel} className="mt-2 grid grid-cols-5 gap-1.5">
                {SCENES.map((scene) => (
                    <button
                        key={scene.id}
                        type="button"
                        role="radio"
                        aria-checked={isImage(scene.id)}
                        onClick={() => onChange({ kind: "image", url: scene.url, id: scene.id })}
                        title={t.pages.removeBackground.scenes[scene.id]}
                        className={cn(
                            "relative aspect-square overflow-hidden rounded-lg border transition-[border-color,scale] duration-200 active:scale-95 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                            isImage(scene.id) ? "border-[var(--tool)] ring-2 ring-[var(--tool)]" : "border-[var(--card-line)] hover:border-[var(--tool-line)]",
                        )}
                    >
                        <img src={scene.url} alt={t.pages.removeBackground.scenes[scene.id]} className="size-full object-cover" loading="lazy" draggable={false} />
                        {isImage(scene.id) && <Tick tone="light" />}
                    </button>
                ))}

                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    title={t.pages.removeBackground.uploadBackground}
                    className={cn(
                        "relative grid aspect-square place-items-center overflow-hidden rounded-lg border border-dashed transition-[border-color,scale] duration-200 active:scale-95 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                        uploaded && isImage(uploaded.id) ? "border-[var(--tool)] ring-2 ring-[var(--tool)]" : "border-[var(--card-line)] hover:border-[var(--tool)]",
                    )}
                >
                    {uploaded ? (
                        <img src={uploaded.url} alt="" className="size-full object-cover" draggable={false} />
                    ) : (
                        <ImageUp className="size-4 text-tertiary" aria-hidden />
                    )}
                    <span className="sr-only">{t.pages.removeBackground.uploadBackground}</span>
                    {uploaded && isImage(uploaded.id) && <Tick tone="light" />}
                </button>
            </div>
            <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={onUpload} hidden tabIndex={-1} />
        </section>
    );
}

function Swatch({
    selected,
    label,
    onSelect,
    className,
    style,
    tick = "light",
    children,
}: {
    selected: boolean;
    label: string;
    onSelect: () => void;
    className?: string;
    style?: CSSProperties;
    tick?: "light" | "dark";
    children?: ReactNode;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            title={label}
            style={style}
            className={cn(
                "relative grid size-8 place-items-center overflow-hidden rounded-lg border transition-[border-color,scale] duration-200 active:scale-95 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                selected ? "border-[var(--tool)] ring-2 ring-[var(--tool)]" : "border-[var(--card-line)] hover:border-[var(--tool-line)]",
                className,
            )}
        >
            {children}
            <span className="sr-only">{label}</span>
            {selected && !children && <Tick tone={tick} />}
        </button>
    );
}

function Tick({ tone }: { tone: "light" | "dark" }) {
    return (
        <span aria-hidden className="absolute inset-0 grid place-items-center">
            <Check className={cn("size-4 drop-shadow", tone === "light" ? "text-white" : "text-neutral-900")} />
        </span>
    );
}
