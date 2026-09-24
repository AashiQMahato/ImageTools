import { Segmented } from "@/components/common/Segmented";
import { useT } from "@/i18n";
import { type ExportFormat, FORMATS } from "./exportFormat";

interface FormatPickerProps {
    value: ExportFormat;
    onChange: (format: ExportFormat) => void;
    /** Formats that would lose something here, with the reason shown on hover. */
    unavailable?: Partial<Record<ExportFormat, string>>;
    /** A caveat about the current choice, e.g. that JPG will flatten transparency. */
    note?: string;
}

/** One format control for every tool, so "download as" means the same thing everywhere. */
export function FormatPicker({ value, onChange, unavailable, note }: FormatPickerProps) {
    const t = useT();
    return (
        <section>
            <h3 className="text-label text-quaternary">{t.workspace.downloadFormat}</h3>
            <div className="mt-2">
                <Segmented
                    label={t.workspace.downloadFormat}
                    value={value}
                    onChange={onChange}
                    className="w-full [&>button]:flex-1"
                    options={FORMATS.map((entry) => ({
                        value: entry.id,
                        label: t.workspace.formatNames[entry.id],
                        disabled: Boolean(unavailable?.[entry.id]),
                        title: unavailable?.[entry.id],
                    }))}
                />
            </div>
            {note && <p className="mt-2 text-xs text-tertiary">{note}</p>}
        </section>
    );
}
