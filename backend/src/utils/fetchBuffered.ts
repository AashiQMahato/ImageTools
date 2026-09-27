/**
 * `fetch` for calls to our own internal services: cancellable (client gone, timeout) only until the
 * response starts arriving; from then on the body is read to the end and returned, fully in memory,
 * as a fresh Response.
 *
 * Why: in this Node's fetch (undici), aborting while a response body is still streaming can throw
 * "ReadableStream is already closed" from inside undici — uncatchable, and it takes the whole API
 * down. Internal replies are small and quick, so finishing them costs nothing.
 */
export async function fetchBuffered(url: string, { signal, ...init }: RequestInit & { signal: AbortSignal }): Promise<Response> {
    const controller = new AbortController();
    const forward = () => controller.abort(signal.reason);
    if (signal.aborted) forward();
    else signal.addEventListener("abort", forward, { once: true });
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        // Headers are in: stop listening, so nothing can cancel the body mid-stream.
        signal.removeEventListener("abort", forward);
        const body = await response.arrayBuffer();
        return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
    } finally {
        signal.removeEventListener("abort", forward);
    }
}
