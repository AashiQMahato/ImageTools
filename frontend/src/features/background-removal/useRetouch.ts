import { useCallback, useEffect, useRef, useState } from "react";
import { baseName } from "@/features/image-processing/format";
import type { ImageFile, ProcessedImage } from "@/types/image";
import { applyEdit, type BrushMode, type Edit, replay, type Selection } from "./retouch";

async function bitmapFrom(url: string): Promise<ImageBitmap> {
    return createImageBitmap(await (await fetch(url)).blob());
}

/**
 * Manual clean-up of what the model left behind: an area is selected, then applied. Edits are kept
 * as a list and replayed from the original cut-out, so undo costs one repaint instead of a
 * full-resolution snapshot per step — on a 12-megapixel photo that is the difference between a few
 * kilobytes and half a gigabyte.
 *
 * Everything that identifies *which* cut-out the work belongs to is derived rather than cleared in
 * an effect, so a fresh result can never show the previous image's edits for a frame.
 */
export function useRetouch(cutout: ProcessedImage | null, original: ImageFile | null) {
    const work = useRef<HTMLCanvasElement | null>(null);
    const cutoutBitmap = useRef<ImageBitmap | null>(null);
    const originalBitmap = useRef<ImageBitmap | null>(null);
    const live = useRef<string | null>(null);
    /** Source of truth, so undo reads the stack without a side effect in a state updater. */
    const stack = useRef<Edit[]>([]);

    const [decodedFor, setDecodedFor] = useState<string | null>(null);
    const [result, setResult] = useState<{ for: string; image: ProcessedImage } | null>(null);
    const [depth, setDepth] = useState(0);
    const [mode, setMode] = useState<BrushMode>("erase");
    /** The area drawn but not yet applied. Nothing changes the image until it is. */
    const [selection, setSelection] = useState<Selection | null>(null);
    /** Bumped after every repaint so the on-screen copy knows to redraw. */
    const [revision, setRevision] = useState(0);

    // Decode once per result. Restoring needs the original photo as well as the cut-out.
    useEffect(() => {
        if (!cutout || !original) return;
        let cancelled = false;

        Promise.all([bitmapFrom(cutout.url), bitmapFrom(original.previewUrl)])
            .then(([cut, source]) => {
                if (cancelled) {
                    cut.close();
                    source.close();
                    return;
                }
                cutoutBitmap.current?.close();
                originalBitmap.current?.close();
                cutoutBitmap.current = cut;
                originalBitmap.current = source;

                const canvas = document.createElement("canvas");
                canvas.width = cut.width;
                canvas.height = cut.height;
                canvas.getContext("2d")?.drawImage(cut, 0, 0);
                work.current = canvas;

                stack.current = [];
                setDepth(0);
                setSelection(null);
                setRevision((value) => value + 1);
                setDecodedFor(cutout.url);
            })
            .catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [cutout, original]);

    useEffect(
        () => () => {
            cutoutBitmap.current?.close();
            originalBitmap.current?.close();
            if (live.current) URL.revokeObjectURL(live.current);
        },
        [],
    );

    /** Encode the working canvas so the composite and the download see the corrected cut-out. */
    const publish = useCallback(
        (edits: readonly Edit[], sourceUrl: string) => {
            const canvas = work.current;
            if (!canvas) return;
            if (edits.length === 0) {
                if (live.current) URL.revokeObjectURL(live.current);
                live.current = null;
                setResult(null);
                return;
            }
            canvas.toBlob((blob) => {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                if (live.current) URL.revokeObjectURL(live.current);
                live.current = url;
                setResult({
                    for: sourceUrl,
                    image: {
                        blob,
                        url,
                        fileName: `${baseName(original?.name ?? "image")}-no-background.png`,
                        dimensions: { width: canvas.width, height: canvas.height },
                    },
                });
            }, "image/png");
        },
        [original?.name],
    );

    const repaint = useCallback(
        (edits: Edit[]) => {
            const canvas = work.current;
            const context = canvas?.getContext("2d");
            const cut = cutoutBitmap.current;
            if (!canvas || !context || !cut || !cutout) return;
            replay(context, cut, edits, originalBitmap.current, canvas.width, canvas.height);
            setRevision((value) => value + 1);
            publish(edits, cutout.url);
        },
        [publish, cutout],
    );

    /** Commits the pending area. Until this runs the selection is only an overlay. */
    const apply = useCallback(() => {
        const context = work.current?.getContext("2d");
        if (!context || !selection || !cutout) return;
        const edit: Edit = { mode, area: selection };
        applyEdit(context, edit, originalBitmap.current);
        stack.current = [...stack.current, edit];
        setDepth(stack.current.length);
        setSelection(null);
        setRevision((value) => value + 1);
        publish(stack.current, cutout.url);
    }, [mode, selection, cutout, publish]);

    const undo = useCallback(() => {
        if (!stack.current.length) return;
        stack.current = stack.current.slice(0, -1);
        setDepth(stack.current.length);
        setSelection(null);
        repaint(stack.current);
    }, [repaint]);

    const clear = useCallback(() => {
        if (!stack.current.length) return;
        stack.current = [];
        setDepth(0);
        setSelection(null);
        repaint([]);
    }, [repaint]);

    return {
        canvas: work,
        revision,
        ready: cutout !== null && decodedFor === cutout.url,
        edited: cutout && result?.for === cutout.url ? result.image : null,
        mode,
        setMode,
        selection,
        setSelection,
        apply,
        editCount: depth,
        undo,
        clear,
    };
}
