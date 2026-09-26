import { useEffect, useState } from "react";
import { apiUrl, type GeneratedPhoto } from "@/lib/api/photoGeneratorApi";
import { loadDraftPhoto, saveDraftPhoto } from "@/lib/draft";

export interface LocalCopies {
    /** Object URLs of the finished files, in this browser. */
    jpg: string;
    png: string;
}

async function fetchFile(path: string, signal: AbortSignal) {
    const response = await fetch(apiUrl(path), { signal });
    if (!response.ok) throw new Error(String(response.status));
    return response.blob();
}

/**
 * The finished photo's files, held in this browser. Generated files live on the server only briefly
 * (in memory, gone after a restart or their time limit), so the preview and downloads use these
 * copies. Each version (a crop adjustment is a new one) is also saved as the draft, so a reload
 * brings back exactly this photo — taken from the saved copy, not the server.
 */
export function useLocalCopies(result: GeneratedPhoto | null, imageId: string | undefined): LocalCopies | null {
    const [copies, setCopies] = useState<(LocalCopies & { key: string }) | null>(null);
    const key = result?.imageUrl;
    useEffect(() => {
        if (!result || !key || !imageId) return;
        const controller = new AbortController();
        let urls: string[] = [];
        (async () => {
            const saved = await loadDraftPhoto<GeneratedPhoto>(imageId);
            const files =
                saved?.result.imageUrl === key
                    ? { jpg: saved.jpg, png: saved.png }
                    : { jpg: await fetchFile(result.imageUrl, controller.signal), png: await fetchFile(result.pngUrl, controller.signal) };
            if (controller.signal.aborted) return;
            urls = [URL.createObjectURL(files.jpg), URL.createObjectURL(files.png)];
            setCopies({ key, jpg: urls[0]!, png: urls[1]! });
            if (saved?.result.imageUrl !== key) void saveDraftPhoto({ imageId, result, ...files });
        })().catch(() => undefined);
        return () => {
            controller.abort();
            urls.forEach((url) => URL.revokeObjectURL(url));
        };
        // A new version of the photo is a new imageUrl; the rest of `result` travels with it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, imageId]);
    return copies?.key === key ? copies : null;
}

/** Downloads a server file by fetching it first, so a missing file is reported instead of a broken download. */
export async function downloadFromServer(path: string, fileName: string, save: (url: string, name: string) => void) {
    const response = await fetch(apiUrl(path));
    if (!response.ok) throw new Error(String(response.status));
    const url = URL.createObjectURL(await response.blob());
    save(url, fileName);
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
