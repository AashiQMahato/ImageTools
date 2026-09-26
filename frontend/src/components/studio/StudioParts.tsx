import { AlertCircle, CheckCircle2, CircleAlert, Clipboard, ImagePlus, Info, Lock, RotateCcw, Trash2 } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { CompareSlider } from "@/components/common/CompareSlider";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { useFitSize } from "@/hooks/useFitSize";
import { cn } from "@/lib/utils/cn";
import type { ImageDimensions } from "@/types/image";
import { useT } from "@/i18n";
import { useStudio } from "./StudioShell";

/** The bordered box the image lives in. Fills the centre card on desktop; a fixed share of the screen on phones. */
export function StudioCanvas({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("relative flex h-[58svh] min-h-[20rem] flex-col overflow-hidden rounded-xl border border-[var(--card-line)] bg-secondary lg:h-auto lg:min-h-0 lg:flex-1", className)}>{children}</div>;
}

/** The empty state every tool shares: one clear target, the limits, and the ways in (drop, paste, choose). */
export function StudioDropzone({ title, hint }: { title: string; hint: string }) {
    const t = useT();
    const { openPicker, uploadError } = useStudio();
    return (
        <div className="animate-enter flex flex-1 items-center justify-center p-4 [--i:-1] sm:p-8">
            <button
                type="button"
                onClick={openPicker}
                className="group flex w-full max-w-xl cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-[var(--card-line)] bg-primary px-6 py-10 text-center transition-colors duration-200 outline-focus-ring hover:border-[var(--brand)] focus-visible:outline-2 focus-visible:outline-offset-4 sm:py-14"
            >
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-solid text-white transition-transform duration-300 ease-[var(--ease-out)] group-hover:-translate-y-0.5">
                    <ImagePlus className="size-6" aria-hidden />
                </span>
                <span className="mt-5 text-lg font-semibold text-primary">{title}</span>
                <span className="mt-1 max-w-sm text-sm text-tertiary">{hint}</span>
                <span className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-solid px-4 text-sm font-semibold text-white">
                    <ImagePlus className="size-4" aria-hidden />
                    {t.common.chooseImage}
                </span>
                <span className="mt-4 text-xs text-quaternary">{t.common.uploadHint}</span>
                <span className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs text-tertiary">
                    <span className="inline-flex items-center gap-1.5 [@media(hover:none)]:hidden">
                        <Clipboard className="size-3.5" aria-hidden />
                        {t.upload.pasteChip}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Lock className="size-3.5" aria-hidden />
                        {t.upload.neverStored}
                    </span>
                </span>
            </button>
            {uploadError && (
                <p role="alert" className="sr-only">
                    {uploadError}
                </p>
            )}
        </div>
    );
}

export function StudioError({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
    const t = useT();
    return (
        <div role="alert" className="animate-enter flex flex-1 flex-col items-center justify-center p-6 text-center [--i:-1]">
            <span className="grid size-12 place-items-center rounded-2xl bg-error-primary text-error-primary">
                <AlertCircle className="size-6" aria-hidden />
            </span>
            <p className="mt-4 text-md font-semibold text-primary">{title}</p>
            <p className="mt-1 max-w-sm text-sm text-tertiary">{message}</p>
            {onRetry && (
                <Button size="md" color="primary" iconLeading={RotateCcw} onPress={onRetry} className="press-scale mt-5 pointer-coarse:min-h-11">
                    {t.common.tryAgain}
                </Button>
            )}
        </div>
    );
}

export type NoticeTone = "success" | "info" | "error";
export interface Notice {
    tone: NoticeTone;
    text: string;
}

/** One line under the canvas saying what just happened. */
export function StudioNotice({ notice }: { notice: Notice }) {
    const Icon = notice.tone === "success" ? CheckCircle2 : notice.tone === "error" ? CircleAlert : Info;
    return (
        <p
            key={notice.text}
            role={notice.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            className={cn(
                "animate-enter flex min-h-11 items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm [--i:-1]",
                notice.tone === "success" && "border-transparent bg-success-primary text-success-primary",
                notice.tone === "info" && "border-[var(--card-line)] bg-secondary text-secondary",
                notice.tone === "error" && "border-error_subtle bg-error-primary text-error-primary",
            )}
        >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{notice.text}</span>
        </p>
    );
}

/** Removes the image from the studio (and every tool), back to the empty drop zone. */
export function ClearImageButton({ className }: { className?: string }) {
    const t = useT();
    const { clearImage } = useStudio();
    return (
        <Button size="lg" color="tertiary" iconLeading={Trash2} onPress={clearImage} className={cn("press-scale pointer-coarse:min-h-12", className)}>
            {t.studio.clearImage}
        </Button>
    );
}

/** The centre card's action row. */
export function StudioActions({ children }: { children: ReactNode }) {
    return <div className="flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:gap-3 [&>*]:sm:min-w-48">{children}</div>;
}

export interface PanelTab<T extends string> {
    id: T;
    label: string;
    icon: ReactNode;
    disabled?: boolean;
}

/** Tabs across the top of the right-hand panel (arrow keys move between them). */
export function PanelTabs<T extends string>({ tabs, value, onChange, label }: { tabs: readonly PanelTab<T>[]; value: T; onChange: (tab: T) => void; label: string }) {
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const enabled = tabs.filter((tab) => !tab.disabled);
        const index = enabled.findIndex((tab) => tab.id === value);
        const next = enabled[(index + (event.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
        if (!next) return;
        onChange(next.id);
        (event.currentTarget.querySelector(`[data-tab="${next.id}"]`) as HTMLElement | null)?.focus();
    };
    return (
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex shrink-0 gap-1 border-b border-[var(--card-line)] bg-secondary p-1.5">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-tab={tab.id}
                    aria-selected={value === tab.id}
                    tabIndex={value === tab.id ? 0 : -1}
                    disabled={tab.disabled}
                    onClick={() => onChange(tab.id)}
                    className={cn(
                        "relative flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors duration-150 outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-40",
                        value === tab.id ? "bg-primary text-[var(--brand)] shadow-xs" : "text-tertiary hover:text-primary",
                    )}
                >
                    {/* Phones keep the words, which say more than the icons in the space there is. */}
                    <span className="hidden shrink-0 sm:inline-flex">{tab.icon}</span>
                    <span className="truncate">{tab.label}</span>
                    {value === tab.id && <span aria-hidden className="absolute inset-x-5 -bottom-1.5 h-0.5 rounded-full bg-[var(--brand)]" />}
                </button>
            ))}
        </div>
    );
}

/** The scrolling body of the right-hand panel. */
export function PanelBody({ children, id }: { children: ReactNode; id?: string }) {
    return (
        <div key={id} className="animate-enter flex flex-col gap-6 p-4 [--i:-1] sm:p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {children}
        </div>
    );
}

/** What the panel says before there's an image: the tool, in three steps. */
export function PanelIntro({ title, steps }: { title: string; steps: readonly string[] }) {
    return (
        <section>
            <h3 className="text-sm font-semibold text-primary">{title}</h3>
            <ol className="mt-3 flex flex-col gap-3">
                {steps.map((step, index) => (
                    <li key={step} className="flex gap-3 text-sm text-secondary">
                        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-xs font-semibold text-[var(--brand)] tabular-nums">{index + 1}</span>
                        <span className="pt-0.5">{step}</span>
                    </li>
                ))}
            </ol>
        </section>
    );
}

// ------------------------------------------------------------------ fitted images

const ZOOM_LEVELS = [1, 2, 4] as const;
type Zoom = (typeof ZOOM_LEVELS)[number];

/** Sizes children to the largest box with the image's aspect ratio that fits the canvas. */
export function Fitted({ dimensions, children }: { dimensions: ImageDimensions; children: (size: { width: number; height: number }) => ReactNode }) {
    const areaRef = useRef<HTMLDivElement>(null);
    const size = useFitSize(areaRef, dimensions.width / dimensions.height);
    return (
        <div className="flex flex-1 p-3 sm:p-6 lg:min-h-0">
            <div ref={areaRef} className="relative flex min-h-0 flex-1 items-center justify-center">
                {size && children(size)}
            </div>
        </div>
    );
}

/** The result beside the original: a draggable divider, with 2× and 4× magnification that follows the pointer. */
export function CompareView({
    before,
    after,
    beforeLabel,
    afterLabel,
    size,
    transparentBefore,
}: {
    before: { src: string; alt: string };
    after: { src: string; alt: string };
    beforeLabel: string;
    afterLabel: string;
    size: { width: number; height: number };
    transparentBefore?: boolean;
}) {
    const t = useT();
    const [position, setPosition] = useState(50);
    const [zoom, setZoom] = useState<Zoom>(1);
    const [origin, setOrigin] = useState({ x: 50, y: 50 });
    const follow = (event: PointerEvent<HTMLDivElement>) => {
        if (zoom === 1 || (event.pointerType !== "mouse" && event.type === "pointermove")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setOrigin({ x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)), y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)) });
    };
    const imageClass = "absolute inset-0 size-full object-contain";
    return (
        <div className="animate-enter relative [--i:-1]" style={size} onPointerMove={follow} onPointerDown={follow}>
            <CompareSlider
                value={position}
                onChange={setPosition}
                beforeLabel={beforeLabel}
                afterLabel={afterLabel}
                className="rounded-lg"
                style={size}
                zoom={zoom > 1 ? { scale: zoom, origin } : undefined}
                before={
                    <>
                        {transparentBefore && <div className="absolute inset-0 bg-checkerboard" />}
                        <img src={before.src} alt={before.alt} className={imageClass} draggable={false} />
                    </>
                }
                after={<img src={after.src} alt={after.alt} className={imageClass} draggable={false} />}
            />
            <div className="absolute bottom-3 left-3 rounded-xl border border-[var(--card-line)] bg-primary p-0.5 shadow-sm">
                <Segmented
                    size="sm"
                    label={t.workspace.zoom}
                    value={zoom}
                    onChange={setZoom}
                    options={ZOOM_LEVELS.map((level) => ({ value: level, label: level === 1 ? t.workspace.fit : `${level}×`, ariaLabel: level === 1 ? t.workspace.fitAria : t.workspace.zoomAria(level) }))}
                />
            </div>
        </div>
    );
}
