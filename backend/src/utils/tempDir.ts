import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Runs `task` inside a fresh, private, randomly named temp directory and always deletes it afterwards —
 * on success, failure, timeout or cancellation. File names inside are fixed by the server, never taken from users.
 */
export async function withTempDir<T>(task: (dir: string) => Promise<T>): Promise<T> {
    const dir = await mkdtemp(path.join(os.tmpdir(), "image-tools-"));
    try {
        return await task(dir);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
}
