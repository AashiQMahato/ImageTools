import { API_BASE_URL, ApiError } from "./apiClient";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export interface JobFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    pages?: number;
}

export interface Job {
    id: string;
    operation: string;
    status: JobStatus;
    progress: { step: string; done: number; total: number };
    files: JobFile[];
    summary: Record<string, number | undefined>;
    error: { code: string; message: string } | null;
    expiresAt: string;
}

async function failure(response: Response) {
    const body = (await response.json().catch(() => null)) as { message?: string; code?: string } | null;
    return new ApiError(body?.message ?? "Something went wrong. Please try again.", response.status, body?.code);
}

/**
 * Uploads the files and options, and resolves with the job the server started for them (202).
 * XMLHttpRequest, because it's the only browser API that reports upload progress.
 */
export function startJob(path: string, form: FormData, { signal, onUploadProgress }: { signal?: AbortSignal; onUploadProgress?: (fraction: number) => void } = {}): Promise<Job> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE_URL}/api${path}`);
        xhr.responseType = "json";
        xhr.upload.onprogress = (event) => event.lengthComputable && onUploadProgress?.(event.loaded / event.total);
        xhr.onload = () => {
            const body = xhr.response as { data?: Job; message?: string; code?: string } | null;
            if (xhr.status >= 200 && xhr.status < 300 && body?.data) resolve(body.data);
            else reject(new ApiError(body?.message ?? "Something went wrong. Please try again.", xhr.status, body?.code));
        };
        xhr.onerror = () => reject(new ApiError("Couldn't reach the server. Check your connection and try again.", 0, "NETWORK"));
        xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
        signal?.addEventListener("abort", () => xhr.abort(), { once: true });
        xhr.send(form);
    });
}

export async function getJob(id: string, signal?: AbortSignal): Promise<Job> {
    const response = await fetch(`${API_BASE_URL}/api/jobs/${encodeURIComponent(id)}`, { signal, cache: "no-store" });
    if (!response.ok) throw await failure(response);
    return ((await response.json()) as { data: Job }).data;
}

/** Stops a job and deletes its files on the server now (rather than when they'd expire). */
export function deleteJob(id: string) {
    void fetch(`${API_BASE_URL}/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
}

export const jobFileUrl = (jobId: string, fileId: string, inline = false) => `${API_BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/files/${encodeURIComponent(fileId)}${inline ? "?inline=1" : ""}`;
export const jobArchiveUrl = (jobId: string) => `${API_BASE_URL}/api/jobs/${encodeURIComponent(jobId)}/archive`;

/** Every result file as one ZIP (to save under a name of your choice). */
export async function fetchJobArchive(jobId: string, signal?: AbortSignal): Promise<Blob> {
    const response = await fetch(jobArchiveUrl(jobId), { signal });
    if (!response.ok) throw await failure(response);
    return response.blob();
}

/** A result file's contents (for previews). */
export async function fetchJobFile(jobId: string, fileId: string, signal?: AbortSignal): Promise<Blob> {
    const response = await fetch(jobFileUrl(jobId, fileId, true), { signal });
    if (!response.ok) throw await failure(response);
    return response.blob();
}
