import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/apiClient";
import { type CompressedImage, compressImage, type CompressSettings } from "@/lib/api/compressApi";
import type { ImageDimensions } from "@/types/image";
import type { AppErrorInfo } from "@/i18n";

export type ItemStatus = "waiting" | "processing" | "done" | "error";

export interface QueueItem {
    id: string;
    file: File;
    name: string;
    size: number;
    mimeType: string;
    dimensions: ImageDimensions;
    /** A small copy for the list (never the full image). */
    thumbUrl: string | null;
    /** The original, for the comparison. */
    previewUrl: string;
    status: ItemStatus;
    uploadProgress: number;
    result: (CompressedImage & { url: string; settingsKey: string }) | null;
    error: AppErrorInfo | null;
}

/** At most this many images in the list at once. */
export const MAX_ITEMS = 30;
/** Compressions running at the same time (the server's own limit is per request). */
const PARALLEL = 2;
const THUMB_SIDE = 160;

export const settingsKey = (settings: CompressSettings) => JSON.stringify(settings);

/** A small thumbnail, so the list never decodes full-size images more than once. */
async function thumbnail(file: File, { width, height }: ImageDimensions): Promise<string | null> {
    try {
        const scale = Math.min(1, THUMB_SIDE / Math.max(width, height));
        const bitmap = await createImageBitmap(file, { resizeWidth: Math.max(1, Math.round(width * scale)), resizeHeight: Math.max(1, Math.round(height * scale)), resizeQuality: "medium" });
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
        return blob ? URL.createObjectURL(blob) : null;
    } catch {
        return null;
    }
}

const release = (item: QueueItem) => {
    URL.revokeObjectURL(item.previewUrl);
    if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
    if (item.result) URL.revokeObjectURL(item.result.url);
};

/**
 * The images being compressed: each keeps its original, a thumbnail and — once done — its result,
 * all in this browser. "Compress" works through everything not yet done with the current settings,
 * a couple at a time, each with its own status.
 */
export function useCompressionQueue() {
    const [items, setItems] = useState<QueueItem[]>([]);
    const latest = useRef(items);
    useEffect(() => {
        latest.current = items;
    }, [items]);
    const controllers = useRef(new Map<string, AbortController>());

    // Leaving the page releases everything (checked after a tick, so a development re-mount doesn't).
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        const running = controllers.current;
        return () => {
            mounted.current = false;
            window.setTimeout(() => {
                if (mounted.current) return;
                running.forEach((controller) => controller.abort());
                latest.current.forEach(release);
            }, 0);
        };
    }, []);

    const update = useCallback((id: string, patch: Partial<QueueItem> | ((item: QueueItem) => Partial<QueueItem>)) => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, ...(typeof patch === "function" ? patch(item) : patch) } : item)));
    }, []);

    /** Adds ready-to-use files; returns how many were skipped for being over the limit. */
    const add = useCallback(async (files: { file: File; dimensions: ImageDimensions }[]) => {
        const room = Math.max(0, MAX_ITEMS - latest.current.length);
        const accepted = files.slice(0, room);
        const added: QueueItem[] = await Promise.all(
            accepted.map(async ({ file, dimensions }) => ({
                id: crypto.randomUUID(),
                file,
                name: file.name,
                size: file.size,
                mimeType: file.type,
                dimensions,
                thumbUrl: await thumbnail(file, dimensions),
                previewUrl: URL.createObjectURL(file),
                status: "waiting" as const,
                uploadProgress: 0,
                result: null,
                error: null,
            })),
        );
        setItems((current) => [...current, ...added]);
        return { added: added.map((item) => item.id), skipped: files.length - accepted.length };
    }, []);

    const remove = useCallback((id: string) => {
        controllers.current.get(id)?.abort();
        setItems((current) => {
            const item = current.find((entry) => entry.id === id);
            if (item) release(item);
            return current.filter((entry) => entry.id !== id);
        });
    }, []);

    const clear = useCallback(() => {
        controllers.current.forEach((controller) => controller.abort());
        controllers.current.clear();
        setItems((current) => {
            current.forEach(release);
            return [];
        });
    }, []);

    const compressOne = useCallback(
        async (id: string, settings: CompressSettings) => {
            const item = latest.current.find((entry) => entry.id === id);
            if (!item) return;
            const controller = new AbortController();
            controllers.current.set(id, controller);
            update(id, { status: "processing", uploadProgress: 0, error: null });
            try {
                const result = await compressImage(item.file, settings, { signal: controller.signal, onUploadProgress: (fraction) => update(id, { uploadProgress: fraction }) });
                const url = URL.createObjectURL(result.blob);
                update(id, (current) => {
                    if (current.result) URL.revokeObjectURL(current.result.url);
                    return { status: "done", result: { ...result, url, settingsKey: settingsKey(settings) } };
                });
            } catch (error) {
                if (controller.signal.aborted) return;
                update(id, { status: "error", error: error instanceof ApiError ? { code: error.code ?? (error.status === 0 ? "NETWORK" : undefined) } : { code: "GENERIC" } });
            } finally {
                controllers.current.delete(id);
            }
        },
        [update],
    );

    /** Everything that hasn't been compressed with these exact settings (or failed), a couple at a time. */
    const compressAll = useCallback(
        async (settings: CompressSettings) => {
            const key = settingsKey(settings);
            const pending = latest.current.filter((item) => item.status !== "processing" && item.result?.settingsKey !== key).map((item) => item.id);
            for (const id of pending) update(id, { status: "waiting", error: null });
            const worker = async () => {
                for (let id = pending.shift(); id; id = pending.shift()) await compressOne(id, settings);
            };
            await Promise.all(Array.from({ length: Math.min(PARALLEL, pending.length) }, worker));
        },
        [compressOne, update],
    );

    return { items, add, remove, clear, compressAll };
}
