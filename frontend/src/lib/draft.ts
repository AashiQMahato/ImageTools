/**
 * The working image survives a reload: the file is kept in this browser's IndexedDB (on the user's device,
 * never sent anywhere) until the user replaces or closes it. Every call fails soft — private windows or
 * blocked storage simply mean no draft.
 */

const DB_NAME = "image-tools";
const STORE = "draft";
const KEY = "current";

export interface DraftImage {
    id: string;
    file: File;
    width: number;
    height: number;
    editedBy?: string;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await openDb();
    try {
        return await new Promise<T>((resolve, reject) => {
            const request = action(db.transaction(STORE, mode).objectStore(STORE));
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } finally {
        db.close();
    }
}

export async function saveDraftImage(draft: DraftImage) {
    try {
        await run("readwrite", (store) => store.put(draft, KEY));
    } catch {
        // No storage available: the image just won't survive a reload.
    }
}

export async function clearDraftImage() {
    try {
        await run("readwrite", (store) => store.delete(KEY));
    } catch {
        // Nothing to clear.
    }
    clearDraftEdits();
}

export async function loadDraftImage(): Promise<DraftImage | null> {
    try {
        const draft = (await run("readonly", (store) => store.get(KEY))) as DraftImage | undefined;
        return draft?.file instanceof Blob ? draft : null;
    } catch {
        return null;
    }
}

// Edits are small JSON, kept in localStorage so the editor can read them synchronously when it opens.
const EDITS_KEY = "draft-edits";

export function saveDraftEdits<T>(imageId: string, edits: T) {
    try {
        localStorage.setItem(EDITS_KEY, JSON.stringify({ imageId, edits }));
    } catch {
        // Storage full or blocked.
    }
}

export function loadDraftEdits<T>(imageId: string): T | null {
    try {
        const saved = JSON.parse(localStorage.getItem(EDITS_KEY) ?? "null") as { imageId: string; edits: T } | null;
        return saved?.imageId === imageId ? saved.edits : null;
    } catch {
        return null;
    }
}

export function clearDraftEdits() {
    try {
        localStorage.removeItem(EDITS_KEY);
    } catch {
        // Ignore.
    }
}
