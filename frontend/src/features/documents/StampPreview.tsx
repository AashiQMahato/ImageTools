import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Stamps drawn over a page preview at their real positions (points → % of the page), turned and faded as they'll be. */
export function StampOverlay({ page, centres, size, rotation, opacity, children }: { page: { width: number; height: number }; centres: { x: number; y: number }[]; size: { width: number; height: number }; rotation: number; opacity: number; children: ReactNode }) {
    return (
        <>
            {centres.map((centre, index) => (
                <span
                    key={index}
                    className="absolute grid place-items-center"
                    style={{
                        left: `${(centre.x / page.width) * 100}%`,
                        top: `${(centre.y / page.height) * 100}%`,
                        width: `${(size.width / page.width) * 100}%`,
                        height: `${(size.height / page.height) * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                        opacity,
                    }}
                >
                    {children}
                </span>
            ))}
        </>
    );
}

/** Text at a size in points, scaled with the page preview (container units: 100cqw = the page's width). */
export function StampText({ text, size, pageWidth, font, color }: { text: string; size: number; pageWidth: number; font: string; color: string }) {
    const family = font.slice(font.indexOf("px ") + 3);
    return (
        <span className="leading-none whitespace-nowrap" style={{ fontSize: `${(size / pageWidth) * 100}cqw`, fontFamily: family, fontWeight: font.startsWith("700") ? 700 : 400, color }}>
            {text}
        </span>
    );
}

type Spot = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";

/** Where on the page: a 3×3 (or 3×2, top and bottom only) grid of spots. */
export function PositionPicker<T extends Spot>({ value, onChange, spots, label, names }: { value: T; onChange: (value: T) => void; spots: readonly T[]; label: string; names: Record<string, string> }) {
    const rows = spots.length === 6 ? 2 : 3;
    return (
        <div role="radiogroup" aria-label={label} className={cn("grid w-36 grid-cols-3 gap-1.5 rounded-xl border border-[var(--card-line)] bg-secondary p-1.5", rows === 2 ? "aspect-[3/2]" : "aspect-[3/4]")}>
            {spots.map((spot) => {
                const active = spot === value;
                return (
                    <button
                        key={spot}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={names[spot]}
                        title={names[spot]}
                        onClick={() => onChange(spot)}
                        className={cn("grid cursor-pointer place-items-center rounded-md outline-focus-ring transition-colors duration-150 focus-visible:outline-2", active ? "bg-[var(--brand)]" : "bg-primary hover:bg-primary_hover")}
                    >
                        <span className={cn("size-1.5 rounded-full", active ? "bg-white" : "bg-[var(--card-line)]")} aria-hidden />
                    </button>
                );
            })}
        </div>
    );
}

/** A colour: the picker, plus a few common choices. */
export function ColourPicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
    const swatches = ["#c0392b", "#1d4ed8", "#6b7280", "#111827"];
    return (
        <div className="flex items-center gap-2" role="group" aria-label={label}>
            {swatches.map((swatch) => (
                <button
                    key={swatch}
                    type="button"
                    aria-label={swatch}
                    aria-pressed={value.toLowerCase() === swatch}
                    onClick={() => onChange(swatch)}
                    className="size-7 cursor-pointer rounded-full border border-black/10 outline-focus-ring focus-visible:outline-2 aria-pressed:ring-2 aria-pressed:ring-[var(--brand)] aria-pressed:ring-offset-2 aria-pressed:ring-offset-[var(--color-bg-primary)]"
                    style={{ background: swatch }}
                />
            ))}
            <label className="relative size-7 cursor-pointer overflow-hidden rounded-full border border-[var(--card-line)] bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" title={label}>
                <span className="sr-only">{label}</span>
                <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
        </div>
    );
}
