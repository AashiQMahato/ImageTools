import { useEffect, useRef, useState } from "react";
import type { ProcessedImage } from "@/types/image";
import { baseName } from "./format";
import { encodeImage, type ExportFormat, formatOf } from "./exportFormat";

/** Re-encoding a large result is not free; wait for the choice to settle first. */
const SETTLE_MS = 120;

interface Encoded {
    image: ProcessedImage;
    /** What this was made from, so staleness is a comparison rather than a flag. */
    format: ExportFormat;
    source: string;
}

/**
 * Offers a result in a different format than the server sent. The source format is a pass-through —
 * re-encoding a PNG to a PNG would only cost time and quality — so this does nothing until the
 * choice actually differs.
 *
 * While a new encode is in flight the previous one stays available; `working` says it is being
 * replaced, which reads better than blanking the download button.
 */
export function useReencode(source: ProcessedImage | null, format: ExportFormat, sourceFormat: ExportFormat, suffix: string, sourceName: string | undefined) {
    const [done, setDone] = useState<Encoded | null>(null);
    /** The URL currently offered. Only ever revoked once its replacement exists. */
    const live = useRef<string | null>(null);

    const passThrough = format === sourceFormat;

    useEffect(() => {
        const release = () => {
            if (live.current) URL.revokeObjectURL(live.current);
            live.current = null;
        };

        if (!source || passThrough) {
            release();
            return;
        }

        let cancelled = false;
        const timer = window.setTimeout(() => {
            encodeImage(source.url, format)
                .then((blob) => {
                    if (cancelled) return;
                    const url = URL.createObjectURL(blob);
                    release(); // the replacement exists now, so the old one can go
                    live.current = url;
                    setDone({
                        format,
                        source: source.url,
                        image: {
                            blob,
                            url,
                            fileName: `${baseName(sourceName ?? "image")}-${suffix}.${formatOf(format).extension}`,
                            dimensions: source.dimensions,
                        },
                    });
                })
                .catch(() => {
                    // Converting is a local extra; on failure the server's own result stays available.
                    if (cancelled) return;
                    release();
                    setDone(null);
                });
        }, SETTLE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [source, format, passThrough, suffix, sourceName]);

    useEffect(
        () => () => {
            if (live.current) URL.revokeObjectURL(live.current);
            live.current = null;
        },
        [],
    );

    if (!source || passThrough) return { encoded: null, working: false };

    // Derived, so no state has to be cleared in an effect just to stay honest.
    const forThisSource = done?.source === source.url ? done : null;
    return { encoded: forThisSource?.image ?? null, working: forThisSource?.format !== format };
}
