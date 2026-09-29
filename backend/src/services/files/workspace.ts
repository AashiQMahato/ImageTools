import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";

/**
 * A private folder for one job's files: uploads and results, under the documents temp root (never a
 * served directory). Names inside are generated here — a user's file name never becomes a path.
 */
export interface Workspace {
    id: string;
    dir: string;
    /** A fresh path in the workspace for a file of this kind. */
    file: (extension: string) => string;
}

const EXTENSION = /^[a-z0-9]{1,5}$/;

export async function createWorkspace(): Promise<Workspace> {
    const id = randomUUID();
    const dir = path.join(env.documents.tempDir, id);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    return {
        id,
        dir,
        file: (extension) => {
            const clean = extension.toLowerCase().replace(/^\./, "");
            if (!EXTENSION.test(clean)) throw new Error("bad extension");
            return path.join(dir, `${randomUUID()}.${clean}`);
        },
    };
}

/** Deletes a workspace and everything in it. Only ever a direct child of the temp root. */
export async function removeWorkspace(dir: string) {
    const root = path.resolve(env.documents.tempDir);
    const target = path.resolve(dir);
    if (path.dirname(target) !== root) return;
    await rm(target, { recursive: true, force: true }).catch(() => undefined);
}

/** Leftovers from a previous run (a crash, a restart) are removed before anything new is written. */
export async function resetWorkspaces() {
    await rm(env.documents.tempDir, { recursive: true, force: true }).catch(() => undefined);
    await mkdir(env.documents.tempDir, { recursive: true, mode: 0o700 });
}
