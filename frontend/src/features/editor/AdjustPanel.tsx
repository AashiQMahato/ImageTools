import { ADJUSTMENT_GROUPS, type AdjustmentKey, type Adjustments, isNeutral, NEUTRAL_ADJUSTMENTS } from "./color";
import { Slider } from "./Slider";
import { useT } from "@/i18n";

interface AdjustPanelProps {
    adjustments: Adjustments;
    onChange: (next: Adjustments) => void;
    onCommit: (next: Adjustments) => void;
}

export function AdjustPanel({ adjustments, onChange, onCommit }: AdjustPanelProps) {
    const t = useT();
    const update = (key: AdjustmentKey, value: number) => ({ ...adjustments, [key]: value });

    return (
        <div className="flex flex-col gap-8">
            {ADJUSTMENT_GROUPS.map((group) => (
                <section key={group.title} aria-label={t.editor.adjust[group.title]} className="flex flex-col gap-5">
                    <h3 className="text-label text-tertiary">{t.editor.adjust[group.title]}</h3>
                    {group.items.map((item) => (
                        <Slider
                            key={item.key}
                            label={t.editor.adjust[item.key]}
                            value={adjustments[item.key]}
                            onChange={(value) => onChange(update(item.key, value))}
                            onCommit={(value) => onCommit(update(item.key, value))}
                        />
                    ))}
                </section>
            ))}
            <button
                type="button"
                disabled={isNeutral(adjustments)}
                onClick={() => onCommit({ ...NEUTRAL_ADJUSTMENTS })}
                className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-[var(--accent)] transition-opacity outline-focus-ring hover:underline focus-visible:outline-2 disabled:opacity-0"
            >
                {t.editor.adjust.reset}
            </button>
        </div>
    );
}
