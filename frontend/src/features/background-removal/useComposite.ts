import { useEffect, useRef, useState } from "react";
import { baseName } from "@/features/image-processing/format";
import type { ProcessedImage } from "@/types/image";
import { type ExportFormat, formatOf } from "@/features/image-processing/exportFormat";
import { type Background, composite } from "./background";

/** The colour input fires continuously while dragging; wait for a pause before re-encoding. */
const SETTLE_MS = 120;

interface Composed {
    image: ProcessedImage;
    /** What this composite was made from, so staleness is a comparison rather than a flag. */
    background: Background;
    format: ExportFormat;
    cutout: string;
}

/** The server already returns exactly this, so re-encoding it would only lose time and quality. */
const isPassThrough = (background: Background, format: ExportFormat) => background.kind === "transparent" && format === "png";

/**
 * Re-composites the cut-out whenever the chosen background changes, and owns the resulting object
 * URL. A transparent background composites nothing: the model's own output is shown and downloaded
 * untouched rather than re-encoded.
 *
 * While a new composite is in flight the previous one stays on screen — `working` says it is being
 * replaced, which reads better than blanking the stage between frames.
 */
export function useComposite(cutout: ProcessedImage | null, background: Background, format: ExportFormat, sourceName: string | undefined) {
    const [done, setDone] = useState<Composed | null>(null);
    /** The URL currently on screen. Only ever revoked once its replacement exists. */
    const live = useRef<string | null>(null);

    useEffect(() => {
        const release = () => {
            if (live.current) URL.revokeObjectURL(live.current);
            live.current = null;
        };

        if (!cutout || isPassThrough(background, format)) {
            release();
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            composite(cutout.url, background, format)
                .then(({ blob }) => {
                    if (cancelled) return;
                    const url = URL.createObjectURL(blob);
                    release(); // the replacement exists now, so the old frame can go
                    live.current = url;
                    setDone({
                        background,
                        format,
                        cutout: cutout.url,
                        image: {
                            blob,
                            url,
                            fileName: `${baseName(sourceName ?? "image")}-${background.kind === "transparent" ? "no-background" : "background"}.${formatOf(format).extension}`,
                            dimensions: cutout.dimensions,
                        },
                    });
                })
                .catch(() => {
                    // Compositing is a local extra; if it fails the untouched cut-out stays available.
                    if (cancelled) return;
                    release();
                    setDone(null);
                });
        }, SETTLE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [cutout, background, format, sourceName]);

    useEffect(
        () => () => {
            if (live.current) URL.revokeObjectURL(live.current);
            live.current = null;
        },
        [],
    );

    if (!cutout || isPassThrough(background, format)) return { composed: null, working: false };

    // Derived, so no state has to be cleared in an effect just to stay honest.
    const forThisCutout = done?.cutout === cutout.url ? done : null;
    const fresh = forThisCutout?.background === background && forThisCutout?.format === format;
    return { composed: forThisCutout?.image ?? null, working: !fresh };
}
