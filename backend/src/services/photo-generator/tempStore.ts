import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";

/**
 * Generated photos and their working copies, held in memory only — never written to disk — under
 * random, unguessable ids, and deleted after a short time (or sooner, when memory is tight).
 */
interface Entry {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    expiresAt: number;
    meta?: unknown;
}

/** Oldest entries go first once the store holds more than this. */
const MAX_BYTES = 400 * 1024 * 1024;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const entries = new Map<string, Entry>();
let bytes = 0;

function remove(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    bytes -= entry.buffer.length;
    entries.delete(id);
}

function sweep() {
    const now = Date.now();
    for (const [id, entry] of entries) if (entry.expiresAt <= now) remove(id);
}
setInterval(sweep, 60_000).unref();

export const tempStore = {
    put(buffer: Buffer, mimeType: string, fileName: string, meta?: unknown): string {
        sweep();
        const id = randomUUID();
        entries.set(id, { buffer, mimeType, fileName, meta, expiresAt: Date.now() + env.photoGenerator.fileTtlMinutes * 60_000 });
        bytes += buffer.length;
        // Map iteration is insertion order: the first entries are the oldest.
        for (const oldest of entries.keys()) {
            if (bytes <= MAX_BYTES || oldest === id) break;
            remove(oldest);
        }
        return id;
    },
    get(id: string): Entry | null {
        if (!ID.test(id)) return null;
        const entry = entries.get(id);
        if (!entry || entry.expiresAt <= Date.now()) {
            remove(id);
            return null;
        }
        return entry;
    },
};

export const fileUrl = (id: string) => `/api/photo-generator/files/${id}`;
