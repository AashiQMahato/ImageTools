import { Segmented } from "@/components/common/Segmented";
import { useImageStore } from "@/store/useImageStore";
import type { UpscaleFactor } from "@/types/image";
import { useT } from "@/i18n";

const SCALES: readonly UpscaleFactor[] = [2, 4];

export function ScalePicker({ disabledScales = [] }: { disabledScales?: readonly UpscaleFactor[] }) {
    const t = useT();
    const scale = useImageStore((state) => state.selectedScale);
    const setScale = useImageStore((state) => state.setSelectedScale);

    return (
        <Segmented
            label={t.pages.upscale.factor}
            value={scale}
            onChange={setScale}
            options={SCALES.map((option) => ({
                value: option,
                label: `${option}×`,
                disabled: disabledScales.includes(option),
                title: disabledScales.includes(option) ? t.pages.upscale.tooLargeFor : undefined,
            }))}
        />
    );
}
