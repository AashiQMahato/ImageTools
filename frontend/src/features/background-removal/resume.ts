import { useImageStore } from "@/store/useImageStore";
import type { ImageFile, ProcessedImage } from "@/types/image";
import { type EditorDoc, INITIAL_DOC } from "./editor/document";

/**
 * The background studio, remembered: the photo, the model's cut-out and every edit made to it. The
 * shared image is only the flattened result, so without this, coming back to the tool would mean
 * removing the background all over again — and losing the edits. With it, the studio reopens exactly
 * as it was left, instantly, for as long as the shared image is still its result.
 *
 * Kept in memory for this visit. The object URLs belong to this record and live as long as it does.
 */
export interface BackgroundSession {
    /** The image the background was removed from. */
    source: ImageFile;
    cutout: ProcessedImage;
    doc: EditorDoc;
    /** The shared image this session last produced. */
    resultId: string | null;
}

let current: BackgroundSession | null = null;

function forget() {
    if (!current) return;
    URL.revokeObjectURL(current.source.previewUrl);
    URL.revokeObjectURL(current.cutout.url);
    current = null;
}

/** Start remembering a fresh removal. The record gets URLs of its own, independent of the job's. */
export function rememberRemoval(source: ImageFile, cutout: ProcessedImage): BackgroundSession {
    forget();
    current = {
        source: { ...source, previewUrl: URL.createObjectURL(source.file) },
        cutout: { ...cutout, url: URL.createObjectURL(cutout.blob) },
        doc: INITIAL_DOC,
        resultId: null,
    };
    return current;
}

/** Record the edits behind the shared image the session just produced. */
export function rememberResult(session: BackgroundSession, doc: EditorDoc, resultId: string | null) {
    if (current !== session) return;
    session.doc = doc;
    session.resultId = resultId;
}

/** The remembered session for this image — either its source photo or the result it produced. */
export function backgroundSessionFor(image: ImageFile | null): BackgroundSession | null {
    if (!image || !current) return null;
    return current.resultId === image.id || current.source.id === image.id ? current : null;
}

// A cleared image takes its session with it.
useImageStore.subscribe((state) => {
    if (!state.original) forget();
});
