import { Check, ChevronLeft, ChevronRight, Circle, CircleDashed, Image as ImageIcon, LoaderCircle, Move, Palette, RotateCcw, Trash2, Upload } from "lucide-react";
import { type ChangeEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants/upload";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import {
    drawBackground,
    DRAWN_TEMPLATES,
    GRADIENT_DIRECTIONS,
    GRADIENT_PRESETS,
    PHOTO_TEMPLATES,
    photoBackground,
    SOLID_PRESETS,
    TEMPLATE_CATEGORIES,
    type TemplateCategory,
} from "./backgrounds";
import type { BackgroundSpec, EditorDoc, Placement } from "./document";

type Update = (update: (doc: EditorDoc) => EditorDoc) => void;
type Kind = "transparent" | "colour" | "gradient" | "image";

export interface UploadedBackground {
    id: string;
    url: string;
    name: string;
}

interface BackgroundControlsProps {
    doc: EditorDoc;
    /** Recorded as one undo step immediately. */
    onCommit: Update;
    /** Shown live; becomes one undo step once it settles (colour wheels, sliders). */
    onPreview: Update;
    /** An uploaded background image, owned by the editor so it outlives this panel. */
    uploaded: UploadedBackground | null;
    onUpload: (file: File) => Promise<void>;
    onRemoveUpload: () => void;
    photoLoading: boolean;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const normaliseHex = (value: string) => {
    const hex = value.trim().replace("#", "").toLowerCase();
    return `#${hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex}`;
};

const RECENT_KEY = "bg-editor:recent-colours";
function readRecent(): string[] {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && HEX.test(item)).slice(0, 8) : [];
    } catch {
        return [];
    }
}
function writeRecent(list: string[]) {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
        // A private window may refuse storage; recent colours are only a convenience.
    }
}

const setBackground = (background: BackgroundSpec) => (doc: EditorDoc) => ({ ...doc, background });
const kindOf = (background: BackgroundSpec): Kind => (background.kind === "template" ? "image" : background.kind);

/**
 * Everything about what's behind the subject. The kind is chosen at the top; each kind's options sit
 * below it in the order people reach for them — a colour, a gradient, a template, their own photo.
 */
export function BackgroundControls({ doc, onCommit, onPreview, uploaded, onUpload, onRemoveUpload, photoLoading }: BackgroundControlsProps) {
    const t = useT();
    const copy = t.bgEditor;
    const { background } = doc;
    const kind = kindOf(background);
    const [recent, setRecent] = useState<string[]>(readRecent);
    /** The last choice of each kind, so switching back to it restores it rather than a default. */
    const lastOf = useRef<Partial<Record<Kind, BackgroundSpec>>>({});
    useEffect(() => {
        lastOf.current[kindOf(background)] = background;
    }, [background]);

    const remember = (value: string) => {
        const next = [value, ...recent.filter((item) => item !== value)].slice(0, 8);
        setRecent(next);
        writeRecent(next);
    };

    const chooseKind = (next: Kind) => {
        if (next === kind) return;
        const fallback: Record<Kind, BackgroundSpec> = {
            transparent: { kind: "transparent" },
            colour: { kind: "colour", value: recent[0] ?? "#ffffff" },
            gradient: { kind: "gradient", ...GRADIENT_PRESETS[0] },
            image: { kind: "template", id: DRAWN_TEMPLATES[0]!.id },
        };
        onCommit(setBackground(lastOf.current[next] ?? fallback[next]));
    };

    const kinds: { id: Kind; label: string; icon: ReactNode }[] = [
        { id: "transparent", label: copy.kinds.transparent, icon: <span aria-hidden className="bg-checkerboard size-6 rounded-md border border-[var(--card-line)]" /> },
        { id: "colour", label: copy.kinds.colour, icon: <Circle className="size-5" aria-hidden /> },
        { id: "gradient", label: copy.kinds.gradient, icon: <Palette className="size-5" aria-hidden /> },
        { id: "image", label: copy.kinds.image, icon: <ImageIcon className="size-5" aria-hidden /> },
    ];

    return (
        <div className="flex flex-col gap-6">
            <section>
                <SectionTitle>{copy.chooseBackground}</SectionTitle>
                <div role="radiogroup" aria-label={copy.chooseBackground} className="grid grid-cols-4 gap-2">
                    {kinds.map((entry) => (
                        <button
                            key={entry.id}
                            type="button"
                            role="radio"
                            aria-checked={kind === entry.id}
                            onClick={() => chooseKind(entry.id)}
                            className={cn(
                                "flex min-h-18 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2.5 text-xs font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                                kind === entry.id ? "border-[var(--tool)] bg-[var(--tool-soft)] text-[var(--tool)]" : "border-[var(--card-line)] text-secondary hover:border-[var(--tool-line)] hover:text-primary",
                            )}
                        >
                            {entry.icon}
                            {entry.label}
                        </button>
                    ))}
                </div>
                {kind === "transparent" && <p className="mt-2 text-xs text-tertiary">{copy.transparentHint}</p>}
            </section>

            <ColourSection background={background} onCommit={onCommit} onPreview={onPreview} recent={recent} remember={remember} />
            <GradientSection background={background} onCommit={onCommit} onPreview={onPreview} />
            <TemplateSection background={background} onCommit={onCommit} onPreview={onPreview} />
            <UploadSection background={background} onCommit={onCommit} onPreview={onPreview} uploaded={uploaded} onUpload={onUpload} onRemove={onRemoveUpload} loading={photoLoading} />
            <SubjectSection placement={doc.placement} onCommit={onCommit} onPreview={onPreview} />
        </div>
    );
}

// ---------------------------------------------------------------- shared bits

function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
    return (
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-primary">{children}</h3>
            {hint}
        </div>
    );
}

/** A selectable tile: swatch, gradient or template. The whole tile is the target. */
function Tile({ selected, label, onSelect, children, className }: { selected: boolean; label: string; onSelect: () => void; children: ReactNode; className?: string }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={onSelect}
            className={cn(
                "relative cursor-pointer overflow-hidden rounded-lg border transition-[border-color,box-shadow,scale] duration-150 outline-focus-ring active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2",
                selected ? "border-[var(--tool)] ring-2 ring-[var(--tool)]" : "border-[var(--card-line)] hover:border-[var(--tool-line)]",
                className,
            )}
        >
            {children}
            {selected && (
                <span aria-hidden className="absolute right-1 bottom-1 grid size-4 place-items-center rounded-full bg-[var(--tool-solid)] text-white">
                    <Check className="size-3" strokeWidth={3} />
                </span>
            )}
        </button>
    );
}

/** A background drawn by the same code as the export, so the thumbnail is honest. */
function Preview({ background, className }: { background: BackgroundSpec; className?: string }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        element.width = Math.round(96 * ratio);
        element.height = Math.round(72 * ratio);
        const ctx = element.getContext("2d");
        if (ctx) drawBackground(ctx, background, element.width, element.height);
    }, [background]);
    return <canvas ref={ref} aria-hidden className={cn("block aspect-[4/3] w-full", className)} />;
}

function Slider({ label, value, min, max, step = 1, format, onChange }: { label: string; value: number; min: number; max: number; step?: number; format: (value: number) => string; onChange: (value: number) => void }) {
    const id = useId();
    return (
        <div>
            <label htmlFor={id} className="flex justify-between text-xs font-medium text-secondary">
                {label}
                <span className="text-tertiary tabular-nums">{format(value)}</span>
            </label>
            <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full accent-[var(--tool-solid)] pointer-coarse:h-8" />
        </div>
    );
}

// ---------------------------------------------------------------- colour

function ColourSection({ background, onCommit, onPreview, recent, remember }: { background: BackgroundSpec; onCommit: Update; onPreview: Update; recent: string[]; remember: (value: string) => void }) {
    const t = useT();
    const copy = t.bgEditor;
    const pickerId = useId();
    const current = background.kind === "colour" ? background.value : "#ffffff";
    const [hex, setHex] = useState(current.toUpperCase());
    const valid = HEX.test(hex.trim());

    // Keep the field in step when the colour changes elsewhere (a swatch, undo).
    const [shownFor, setShownFor] = useState(current);
    if (shownFor !== current) {
        setShownFor(current);
        setHex(current.toUpperCase());
    }

    const choose = (value: string) => {
        onCommit(setBackground({ kind: "colour", value }));
        remember(value);
    };
    const isSelected = (value: string) => background.kind === "colour" && background.value.toLowerCase() === value.toLowerCase();

    return (
        <section>
            <SectionTitle>{copy.customColour}</SectionTitle>
            <p className="-mt-1.5 mb-3 text-xs text-tertiary">{copy.customColourHint}</p>
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--card-line)] bg-primary pr-1 pl-1.5 focus-within:outline-2 focus-within:outline-[var(--color-focus-ring)] pointer-coarse:h-11">
                        {/* The platform's own colour picker, previewing live as it moves. */}
                        <label htmlFor={pickerId} className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[var(--card-line)]" style={{ backgroundColor: valid ? normaliseHex(hex) : current }}>
                            <span className="sr-only">{copy.pickColour}</span>
                            <input
                                id={pickerId}
                                type="color"
                                value={valid ? normaliseHex(hex) : current}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setHex(value.toUpperCase());
                                    onPreview(setBackground({ kind: "colour", value }));
                                }}
                                onBlur={(event) => remember(event.target.value)}
                                className="absolute inset-0 size-full cursor-pointer opacity-0"
                            />
                        </label>
                        <input
                            value={hex}
                            onChange={(event) => setHex(event.target.value.toUpperCase())}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && valid) choose(normaliseHex(hex));
                            }}
                            onBlur={() => {
                                if (valid && normaliseHex(hex) !== current.toLowerCase()) choose(normaliseHex(hex));
                            }}
                            aria-label={copy.hex}
                            aria-invalid={!valid}
                            spellCheck={false}
                            maxLength={7}
                            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-primary outline-none"
                        />
                    </div>
                    <Button size="md" color="secondary" onPress={() => choose(normaliseHex(hex))} isDisabled={!valid || isSelected(normaliseHex(hex))} className="press-scale shrink-0 pointer-coarse:min-h-11">
                        {copy.applyColour}
                    </Button>
                </div>
                <div role="radiogroup" aria-label={copy.presetColours} className="flex flex-wrap gap-1.5">
                    {SOLID_PRESETS.map((preset) => (
                        <button
                            key={preset.key}
                            type="button"
                            role="radio"
                            aria-checked={isSelected(preset.value)}
                            aria-label={copy.colours[preset.key]}
                            title={copy.colours[preset.key]}
                            onClick={() => choose(preset.value)}
                            className={cn(
                                "size-7 cursor-pointer rounded-full border transition-[scale,box-shadow] duration-150 outline-focus-ring active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:size-9",
                                isSelected(preset.value) ? "border-transparent ring-2 ring-[var(--tool)] ring-offset-2 ring-offset-[var(--color-bg-primary)]" : "border-[var(--card-line)]",
                            )}
                            style={{ backgroundColor: preset.value }}
                        />
                    ))}
                </div>
            </div>
            {!valid && <p className="mt-1.5 text-xs text-error-primary">{copy.invalidHex}</p>}

            {recent.length > 0 && (
                <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-tertiary">{copy.recentColours}</span>
                    <div role="radiogroup" aria-label={copy.recentColours} className="flex flex-wrap gap-1.5">
                        {recent.map((value) => (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={isSelected(value)}
                                aria-label={value.toUpperCase()}
                                title={value.toUpperCase()}
                                onClick={() => choose(value)}
                                className={cn(
                                    "size-5 cursor-pointer rounded-full border outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:size-8",
                                    isSelected(value) ? "ring-2 ring-[var(--tool)] ring-offset-1 ring-offset-[var(--color-bg-primary)]" : "border-[var(--card-line)]",
                                )}
                                style={{ backgroundColor: value }}
                            />
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

// ---------------------------------------------------------------- gradient

function GradientSection({ background, onCommit, onPreview }: { background: BackgroundSpec; onCommit: Update; onPreview: Update }) {
    const t = useT();
    const copy = t.bgEditor;
    const custom = background.kind === "gradient" ? background : null;
    const direction = custom ? (GRADIENT_DIRECTIONS.find((entry) => entry.radial === custom.radial && (entry.radial || entry.angle === custom.angle))?.id ?? "diagonal") : "diagonal";
    const fromId = useId();
    const toId = useId();

    const setCustom = (patch: Partial<Extract<BackgroundSpec, { kind: "gradient" }>>, live = false) => {
        if (!custom) return;
        (live ? onPreview : onCommit)(setBackground({ ...custom, ...patch, id: "custom" }));
    };

    return (
        <section>
            <SectionTitle>{copy.gradientPresets}</SectionTitle>
            <div role="radiogroup" aria-label={copy.gradientPresets} className="grid grid-cols-7 gap-1.5">
                {GRADIENT_PRESETS.map((preset) => {
                    const spec: BackgroundSpec = { kind: "gradient", ...preset };
                    return (
                        <Tile key={preset.id} selected={custom?.id === preset.id} label={copy.gradients[preset.id]} onSelect={() => onCommit(setBackground(spec))}>
                            <Preview background={spec} className="aspect-square" />
                        </Tile>
                    );
                })}
            </div>

            {/* Customising only makes sense once a gradient is on the canvas. */}
            {custom && (
                <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--card-line)] p-3">
                    <div className="flex items-center gap-2">
                        {(
                            [
                                [fromId, "from", copy.gradientFrom],
                                [toId, "to", copy.gradientTo],
                            ] as const
                        ).map(([id, key, label]) => (
                            <label key={key} htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-[var(--card-line)] p-1.5 pr-2.5 pointer-coarse:min-h-11">
                                <span className="relative size-7 shrink-0 overflow-hidden rounded-md border border-[var(--card-line)]" style={{ backgroundColor: custom[key] }}>
                                    <input id={id} type="color" value={custom[key]} onChange={(event) => setCustom({ [key]: event.target.value }, true)} className="absolute inset-0 size-full cursor-pointer opacity-0" />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[0.6875rem] text-tertiary">{label}</span>
                                    <span className="block font-mono text-xs text-primary uppercase">{custom[key]}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                    <Segmented
                        size="sm"
                        label={copy.gradientDirection}
                        value={direction}
                        onChange={(id) => {
                            const entry = GRADIENT_DIRECTIONS.find((item) => item.id === id);
                            if (entry) setCustom({ angle: entry.angle, radial: entry.radial });
                        }}
                        className="w-full [&>button]:flex-1"
                        options={GRADIENT_DIRECTIONS.map((entry) => ({ value: entry.id, label: copy.directions[entry.id].symbol, ariaLabel: copy.directions[entry.id].label, title: copy.directions[entry.id].label }))}
                    />
                </div>
            )}
        </section>
    );
}

// ---------------------------------------------------------------- templates

const PAGE = 10;

function TemplateSection({ background, onCommit, onPreview }: { background: BackgroundSpec; onCommit: Update; onPreview: Update }) {
    const t = useT();
    const copy = t.bgEditor;
    const [category, setCategory] = useState<TemplateCategory | "all">("all");
    const [page, setPage] = useState(0);

    const items = [
        ...DRAWN_TEMPLATES.filter((template) => category === "all" || template.category === category).map((template) => ({
            id: template.id,
            label: copy.templates[template.id],
            spec: { kind: "template", id: template.id } as BackgroundSpec,
            thumb: null as string | null,
        })),
        ...(category === "all" || category === "nature" ? PHOTO_TEMPLATES : []).map((photo) => ({ id: photo.id, label: copy.scenes[photo.key], spec: photoBackground(photo.id, photo.url), thumb: photo.url as string | null })),
    ];
    const pages = Math.max(1, Math.ceil(items.length / PAGE));
    const shown = items.slice(page * PAGE, page * PAGE + PAGE);
    const isSelected = (id: string) => (background.kind === "template" || background.kind === "image") && background.id === id;

    return (
        <section>
            <SectionTitle
                hint={
                    pages > 1 && (
                        <span className="flex items-center gap-1">
                            <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} aria-label={copy.previousTemplates} className="grid size-7 cursor-pointer place-items-center rounded-full border border-[var(--card-line)] text-secondary hover:bg-primary_hover disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-9">
                                <ChevronLeft className="size-4" aria-hidden />
                            </button>
                            <button type="button" onClick={() => setPage((value) => Math.min(pages - 1, value + 1))} disabled={page >= pages - 1} aria-label={copy.moreTemplates} className="grid size-7 cursor-pointer place-items-center rounded-full border border-[var(--card-line)] text-secondary hover:bg-primary_hover disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:size-9">
                                <ChevronRight className="size-4" aria-hidden />
                            </button>
                        </span>
                    )
                }
            >
                {copy.backgroundTemplates}
            </SectionTitle>
            <div role="tablist" aria-label={copy.templateCategories} className="scrollbar-hide -mx-1 mb-2.5 flex gap-1 overflow-x-auto px-1 pb-0.5">
                {(["all", ...TEMPLATE_CATEGORIES] as const).map((id) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={category === id}
                        onClick={() => {
                            setCategory(id);
                            setPage(0);
                        }}
                        className={cn(
                            "h-7 shrink-0 cursor-pointer rounded-full px-2.5 text-xs font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 pointer-coarse:h-9",
                            category === id ? "bg-[var(--tool-soft)] text-[var(--tool)]" : "text-tertiary hover:bg-secondary hover:text-primary",
                        )}
                    >
                        {copy.categories[id]}
                    </button>
                ))}
            </div>
            <div role="radiogroup" aria-label={copy.backgroundTemplates} className="grid grid-cols-5 gap-1.5">
                {shown.map((item) => (
                    <Tile key={item.id} selected={isSelected(item.id)} label={item.label} onSelect={() => onCommit(setBackground(item.spec))}>
                        {item.thumb ? <img src={item.thumb} alt="" loading="lazy" draggable={false} className="block aspect-[4/3] w-full object-cover" /> : <Preview background={item.spec} />}
                    </Tile>
                ))}
            </div>
            {background.kind === "image" && !background.id.startsWith("upload") && <PhotoFraming background={background} onPreview={onPreview} onCommit={onCommit} />}
        </section>
    );
}

// ---------------------------------------------------------------- upload

function UploadSection({
    background,
    onCommit,
    onPreview,
    uploaded,
    onUpload,
    onRemove,
    loading,
}: {
    background: BackgroundSpec;
    onCommit: Update;
    onPreview: Update;
    uploaded: UploadedBackground | null;
    onUpload: (file: File) => Promise<void>;
    onRemove: () => void;
    loading: boolean;
}) {
    const t = useT();
    const copy = t.bgEditor;
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [reading, setReading] = useState(false);
    const active = background.kind === "image" && uploaded !== null && background.id === uploaded.id;

    const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return setError(t.upload.wrongType);
        if (file.size > MAX_UPLOAD_BYTES) return setError(t.upload.tooLarge);
        setError(null);
        setReading(true);
        try {
            await onUpload(file);
        } catch {
            setError(t.upload.unreadable);
        } finally {
            setReading(false);
        }
    };

    return (
        <section>
            <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={(event) => void onFile(event)} hidden tabIndex={-1} />
            {uploaded && (
                <div className="mb-2.5 flex items-center gap-3">
                    <Tile selected={active} label={uploaded.name} onSelect={() => onCommit(setBackground(photoBackground(uploaded.id, uploaded.url)))} className="w-20 shrink-0">
                        <img src={uploaded.url} alt="" draggable={false} className="block aspect-[4/3] w-full object-cover" />
                    </Tile>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-primary">{uploaded.name}</p>
                        <p className="text-xs text-tertiary">{active ? copy.inUse : copy.yourBackground}</p>
                    </div>
                    <button type="button" onClick={onRemove} aria-label={copy.removeUpload} className="grid size-9 cursor-pointer place-items-center rounded-lg text-tertiary hover:bg-primary_hover hover:text-error-primary outline-focus-ring focus-visible:outline-2 pointer-coarse:size-11">
                        <Trash2 className="size-4" aria-hidden />
                    </button>
                </div>
            )}
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={reading}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--card-line)] bg-secondary text-sm font-medium text-secondary transition-colors duration-150 outline-focus-ring hover:border-[var(--tool-line)] hover:text-primary focus-visible:outline-2 disabled:cursor-wait"
            >
                {reading ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                {reading ? copy.readingBackground : uploaded ? copy.replaceBackground : copy.uploadBackground}
            </button>
            <p className="mt-1.5 text-center text-xs text-quaternary">{copy.uploadHint}</p>

            {active && loading && (
                <p role="status" className="mt-2 flex items-center gap-2 text-xs text-tertiary">
                    <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
                    {copy.readingBackground}
                </p>
            )}
            {error && (
                <p role="alert" className="mt-2 text-xs text-error-primary">
                    {error}
                </p>
            )}
            {active && background.kind === "image" && <PhotoFraming background={background} onPreview={onPreview} onCommit={onCommit} />}
        </section>
    );
}

/** Zoom into a photo background and choose which part of it shows behind the subject. */
function PhotoFraming({ background, onPreview, onCommit }: { background: Extract<BackgroundSpec, { kind: "image" }>; onPreview: Update; onCommit: Update }) {
    const t = useT();
    const copy = t.bgEditor;
    const live = (patch: Partial<typeof background>) => onPreview(setBackground({ ...background, ...patch }));
    const framed = background.zoom !== 1 || background.x !== 0.5 || background.y !== 0.5;
    return (
        <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[var(--card-line)] p-3">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-secondary">{copy.framing}</p>
                <button type="button" onClick={() => onCommit(setBackground({ ...background, zoom: 1, x: 0.5, y: 0.5 }))} disabled={!framed} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-tertiary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                    <RotateCcw className="size-3" aria-hidden />
                    {copy.resetFraming}
                </button>
            </div>
            <Slider label={copy.backgroundZoom} value={background.zoom} min={1} max={3} step={0.05} format={(value) => `${Math.round(value * 100)}%`} onChange={(zoom) => live({ zoom })} />
            <Slider label={copy.horizontal} value={background.x} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(x) => live({ x })} />
            <Slider label={copy.vertical} value={background.y} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(y) => live({ y })} />
        </div>
    );
}

// ---------------------------------------------------------------- subject

function SubjectSection({ placement, onCommit, onPreview }: { placement: Placement; onCommit: Update; onPreview: Update }) {
    const t = useT();
    const copy = t.bgEditor;
    const moved = placement.x !== 0 || placement.y !== 0 || placement.scale !== 1;
    return (
        <section>
            <SectionTitle
                hint={
                    <button type="button" onClick={() => onCommit((doc) => ({ ...doc, placement: { x: 0, y: 0, scale: 1 } }))} disabled={!moved} className="flex cursor-pointer items-center gap-1 text-xs font-medium text-tertiary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                        <RotateCcw className="size-3" aria-hidden />
                        {copy.resetPosition}
                    </button>
                }
            >
                {copy.subjectTitle}
            </SectionTitle>
            <p className="-mt-1.5 mb-3 flex items-center gap-1.5 text-xs text-tertiary">
                <Move className="size-3.5 shrink-0" aria-hidden />
                {copy.subjectHint}
            </p>
            <Slider label={copy.subjectSize} value={Math.round(placement.scale * 100)} min={20} max={200} format={(value) => `${value}%`} onChange={(value) => onPreview((doc) => ({ ...doc, placement: { ...doc.placement, scale: value / 100 } }))} />
            <Button size="sm" color="secondary" iconLeading={CircleDashed} onPress={() => onCommit((doc) => ({ ...doc, placement: { ...doc.placement, x: 0, y: 0 } }))} isDisabled={placement.x === 0 && placement.y === 0} className="press-scale mt-3 pointer-coarse:min-h-11">
                {copy.centre}
            </Button>
        </section>
    );
}
