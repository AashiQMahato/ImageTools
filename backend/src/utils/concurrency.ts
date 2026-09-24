import { AppError } from "./AppError.js";

/**
 * Runs at most `limit` jobs at once; others wait in a bounded queue.
 * A queued job whose signal aborts (client left) leaves the queue without ever running.
 */
export class ConcurrencyLimiter {
    private active = 0;
    private readonly waiting: Array<{ start: () => void; cancel: () => void }> = [];

    constructor(
        private readonly limit: number,
        private readonly maxQueue: number,
    ) {}

    get stats() {
        return { active: this.active, queued: this.waiting.length, limit: this.limit };
    }

    async run<T>(job: () => Promise<T>, signal: AbortSignal): Promise<T> {
        await this.acquire(signal);
        try {
            return await job();
        } finally {
            this.release();
        }
    }

    private acquire(signal: AbortSignal): Promise<void> {
        if (signal.aborted) return Promise.reject(cancelled());
        if (this.active < this.limit) {
            this.active++;
            return Promise.resolve();
        }
        if (this.waiting.length >= this.maxQueue) {
            return Promise.reject(new AppError("The server is busy processing other images. Please try again in a moment.", 503, "SERVER_BUSY"));
        }

        return new Promise((resolve, reject) => {
            const entry = {
                start: () => {
                    signal.removeEventListener("abort", onAbort);
                    this.active++;
                    resolve();
                },
                cancel: () => reject(cancelled()),
            };
            const onAbort = () => {
                const index = this.waiting.indexOf(entry);
                if (index >= 0) this.waiting.splice(index, 1);
                entry.cancel();
            };
            signal.addEventListener("abort", onAbort, { once: true });
            this.waiting.push(entry);
        });
    }

    private release() {
        this.active--;
        this.waiting.shift()?.start();
    }
}

function cancelled() {
    return new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
}
