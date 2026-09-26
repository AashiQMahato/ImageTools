import { Check, Download, LoaderCircle, Printer } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Button } from "@/components/ui/base/buttons/button";
import { ApiError } from "@/lib/api/apiClient";
import { apiUrl, createPrintSheet, type PrintSheet as Sheet } from "@/lib/api/photoGeneratorApi";
import { downloadFile } from "@/lib/utils/download";
import { useT } from "@/i18n";
import { photoError } from "./labels";
import { downloadFromServer } from "./useLocalCopies";

const OPTIONS = [4, 6, 8, 12] as const;
type Choice = (typeof OPTIONS)[number] | "custom";

/**
 * Optional, and separate from making the photo: copies of it on A4, each at its exact physical size.
 * The sheet is built on the server at the photo's own DPI, previewed here, then downloaded.
 */
export function PrintSheet({ photoId, paper, maxCopies, fileName }: { photoId: string; paper: string; maxCopies: number; fileName: string }) {
    const t = useT();
    const copy = t.photo.sheet;
    const inputId = useId();
    const options = OPTIONS.filter((count) => count <= maxCopies);
    const [choice, setChoice] = useState<Choice>(options.includes(8) ? 8 : (options.at(-1) ?? "custom"));
    const [custom, setCustom] = useState(Math.min(maxCopies, 10));
    const copies = choice === "custom" ? custom : choice;
    const [sheet, setSheet] = useState<Sheet | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [downloaded, setDownloaded] = useState(false);

    // A fresh preview for each choice, once it settles; a newer choice cancels the older request.
    useEffect(() => {
        if (copies < 1 || copies > maxCopies) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            setError(null);
            createPrintSheet(photoId, copies, controller.signal)
                .then(setSheet)
                .catch((cause: unknown) => {
                    if (controller.signal.aborted) return;
                    setError(cause instanceof ApiError && cause.code === "FILE_EXPIRED" ? photoError(t, { code: cause.code }) : copy.failed);
                });
        }, 300);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [photoId, copies, maxCopies, t, copy.failed]);

    useEffect(() => {
        if (!downloaded) return;
        const timer = window.setTimeout(() => setDownloaded(false), 2200);
        return () => window.clearTimeout(timer);
    }, [downloaded]);

    const current = sheet?.copies === copies ? sheet : null;

    return (
        <section className="flex flex-col gap-4">
            <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <Printer className="size-4 text-tertiary" aria-hidden />
                    {copy.title}
                </h3>
                <p className="mt-1 text-xs text-tertiary">{copy.hint(paper, maxCopies)}</p>
            </div>

            <div>
                <p className="mb-2 text-xs font-medium text-secondary">{copy.copies}</p>
                <Segmented
                    label={copy.copies}
                    value={choice}
                    onChange={setChoice}
                    className="w-full [&>button]:flex-1"
                    options={[...options.map((count) => ({ value: count as Choice, label: String(count) })), { value: "custom" as Choice, label: copy.custom }]}
                />
                {choice === "custom" && (
                    <label htmlFor={inputId} className="mt-3 flex items-center justify-between gap-3 text-xs text-secondary">
                        {copy.customLabel(maxCopies)}
                        <input
                            id={inputId}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={maxCopies}
                            value={custom}
                            onChange={(event) => setCustom(Math.max(1, Math.min(maxCopies, Math.round(Number(event.target.value) || 1))))}
                            className="h-10 w-20 rounded-lg border border-[var(--card-line)] bg-primary px-3 text-sm text-primary tabular-nums outline-focus-ring focus-visible:outline-2 pointer-coarse:h-11"
                        />
                    </label>
                )}
            </div>

            <figure className="relative mx-auto w-full max-w-60 overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-[var(--card-line)]" style={{ aspectRatio: "210 / 297" }}>
                {sheet && <img src={apiUrl(sheet.url)} alt={copy.preview} className={current ? "size-full" : "size-full opacity-40"} draggable={false} />}
                {!current && !error && (
                    <figcaption className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-neutral-500">
                        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        {copy.preparing}
                    </figcaption>
                )}
            </figure>

            {error && (
                <p role="alert" className="text-sm text-error-primary">
                    {error}
                </p>
            )}
            <Button
                size="lg"
                color="primary"
                iconLeading={downloaded ? Check : Download}
                isDisabled={!current}
                onPress={() => {
                    if (!current) return;
                    downloadFromServer(current.url, fileName.replace(/\.jpg$/, `-sheet-${current.copies}.jpg`), downloadFile)
                        .then(() => setDownloaded(true))
                        .catch(() => setError(t.photo.downloadFailed));
                }}
                className="press-scale w-full pointer-coarse:min-h-12"
            >
                {downloaded ? t.retouch.downloaded : copy.download}
            </Button>
            <p className="text-xs text-quaternary">{copy.printTip}</p>
        </section>
    );
}
