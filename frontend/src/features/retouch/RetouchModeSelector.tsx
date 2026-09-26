import { Range } from "@/features/background-removal/editor/RefinePanel";
import type { RetouchMode } from "@/lib/api/retouchApi";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { MODES, modeConfig } from "./modes";

interface RetouchModeSelectorProps {
    mode: RetouchMode;
    onModeChange: (mode: RetouchMode) => void;
    strength: number;
    onStrengthChange: (value: number) => void;
    texture: number;
    onTextureChange: (value: number) => void;
    disabled?: boolean;
}

/** What to do with the selected area, in plain words, and the one or two settings that mode has. */
export function RetouchModeSelector({ mode, onModeChange, strength, onStrengthChange, texture, onTextureChange, disabled }: RetouchModeSelectorProps) {
    const t = useT();
    const copy = t.retouch;
    const config = modeConfig(mode);
    const hint = mode === "smooth" || mode === "enhance" || mode === "relight" ? copy.strengthHints[mode] : null;

    return (
        <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-primary">{copy.modeTitle}</h3>
            <div role="radiogroup" aria-label={copy.modeTitle} className="flex flex-col gap-1">
                {MODES.map(({ id, icon: Icon }) => {
                    const selected = id === mode;
                    return (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            onClick={() => onModeChange(id)}
                            className={cn(
                                "group flex cursor-pointer items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-[background-color,border-color] duration-150 outline-focus-ring focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-2.5",
                                selected ? "border-[var(--brand-line)] bg-[var(--brand-soft)]" : "border-transparent hover:bg-secondary",
                            )}
                        >
                            <span
                                className={cn(
                                    "grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-150",
                                    selected ? "bg-brand-solid text-white" : "bg-secondary text-tertiary group-hover:text-primary",
                                )}
                            >
                                <Icon className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0">
                                <span className={cn("block text-sm font-semibold", selected ? "text-[var(--brand)]" : "text-primary")}>{copy.modes[id].label}</span>
                                <span className="block truncate text-xs text-tertiary">{copy.modes[id].hint}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            {(config.strength || config.texture) && (
                <div key={mode} className="animate-enter flex flex-col gap-4 rounded-xl border border-[var(--card-line)] p-3 [--i:-1]">
                    {config.strength && <Range label={copy.strength} value={Math.round(strength * 100)} min={0} max={100} onChange={(value) => onStrengthChange(value / 100)} format={(value) => `${value}%`} />}
                    {config.texture && <Range label={copy.texture} value={Math.round(texture * 100)} min={0} max={100} onChange={(value) => onTextureChange(value / 100)} format={(value) => `${value}%`} />}
                    {hint && <p className="text-xs text-quaternary">{hint}</p>}
                </div>
            )}
        </section>
    );
}
