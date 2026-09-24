import type { ApiResponse } from "@/types/api";

/** Empty in development (Vite proxies `/api`); set VITE_API_BASE_URL when the backend is deployed elsewhere. */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;

    constructor(message: string, status: number, code?: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
    body?: BodyInit | Record<string, unknown>;
}

async function request<T>(path: string, { body, headers, ...init }: RequestOptions = {}): Promise<T> {
    const isJsonBody = body !== undefined && !(body instanceof FormData) && !(body instanceof Blob) && typeof body === "object";

    const response = await fetch(`${API_BASE_URL}/api${path}`, {
        ...init,
        headers: {
            Accept: "application/json",
            ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
            ...headers,
        },
        body: isJsonBody ? JSON.stringify(body) : (body as BodyInit | undefined),
    });

    let payload: ApiResponse<T> | undefined;
    try {
        payload = (await response.json()) as ApiResponse<T>;
    } catch {
        // Non-JSON response; handled below.
    }

    if (!payload) {
        throw new ApiError(`Unexpected response from server (${response.status})`, response.status);
    }
    if (!response.ok || !payload.success) {
        const failure = payload.success ? undefined : payload;
        throw new ApiError(failure?.message ?? `Request failed (${response.status})`, response.status, failure?.code);
    }

    return payload.data;
}

export const apiClient = {
    get: <T>(path: string, init?: RequestOptions) => request<T>(path, { ...init, method: "GET" }),
    post: <T>(path: string, body?: RequestOptions["body"], init?: RequestOptions) => request<T>(path, { ...init, method: "POST", body }),
};
