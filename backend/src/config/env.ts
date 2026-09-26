import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** backend/ — config paths are resolved from here, not from the process working directory. */
export const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function parsePort(value: string | undefined, fallback: number): number {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 ? port : fallback;
}

function parsePositive(value: string | undefined, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value.trim() === "") return fallback;
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parseChoice<T extends string>(value: string | undefined, choices: readonly T[], fallback: T): T {
    const chosen = value?.trim().toLowerCase();
    return choices.find((choice) => choice === chosen) ?? fallback;
}

function parseOrigins(value: string | undefined): string[] {
    return (value ?? "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

/** Resolve an optional path setting relative to backend/. */
function resolvePath(value: string | undefined, fallback: string): string {
    const chosen = value?.trim() ? value.trim() : fallback;
    return path.isAbsolute(chosen) ? chosen : path.resolve(BACKEND_ROOT, chosen);
}

const env_ = process.env;

export const env = {
    nodeEnv: env_.NODE_ENV ?? "development",
    port: parsePort(env_.PORT, 5000),
    /** Allowed CORS origins. FRONTEND_URL may be a comma-separated list. */
    frontendOrigins: parseOrigins(env_.FRONTEND_URL),

    maxImageSizeMb: parsePositive(env_.MAX_IMAGE_SIZE_MB, 10),
    /** Largest decoded image accepted (pixels). Guards against decompression bombs. */
    maxImagePixels: parsePositive(env_.MAX_IMAGE_PIXELS, 40_000_000),

    rembg: {
        model: env_.REMBG_MODEL?.trim() || "bria-rmbg",
        /** Launch the Python service as a managed child process. Disable to run it separately (set REMBG_SERVICE_URL). */
        autostart: parseBoolean(env_.REMBG_AUTOSTART, true),
        serviceUrl: env_.REMBG_SERVICE_URL?.trim() || "",
        serviceToken: env_.REMBG_SERVICE_TOKEN?.trim() || "",
        pythonPath: resolvePath(env_.REMBG_PYTHON_PATH, "python/.venv/bin/python"),
        serviceDir: resolvePath(undefined, "python/rembg_service"),
        modelsDir: resolvePath(env_.REMBG_MODELS_DIR, "python/.models"),
        timeoutMs: parsePositive(env_.REMBG_TIMEOUT_MS, 120_000),
        concurrency: Math.floor(parsePositive(env_.BACKGROUND_REMOVAL_CONCURRENCY, 2)),
        decontaminate: parseBoolean(env_.REMBG_DECONTAMINATE, true),
        alphaMatting: parseBoolean(env_.REMBG_ALPHA_MATTING, false),
    },

    upscayl: {
        enabled: parseBoolean(env_.UPSCAYL_ENABLED, true),
        binaryPath: resolvePath(env_.UPSCAYL_BINARY_PATH, "vendor/upscayl/upscayl-bin"),
        modelsDir: resolvePath(env_.UPSCAYL_MODELS_PATH, "vendor/upscayl/models"),
        model: env_.UPSCAYL_MODEL?.trim() || "upscayl-standard-4x",
        timeoutMs: parsePositive(env_.UPSCALE_TIMEOUT_MS, 300_000),
        concurrency: Math.floor(parsePositive(env_.UPSCALE_CONCURRENCY, 1)),
        /** Largest result allowed (pixels). 4× multiplies pixel count by 16, so 4× accepts smaller inputs than 2×. */
        maxOutputPixels: parsePositive(env_.UPSCALE_MAX_OUTPUT_PIXELS, 40_000_000),
        /** Reserved for an optional hosted fallback. Server-side only; never sent to the browser. */
        cloudApiKey: env_.UPSCAYL_API_KEY?.trim() || "",
    },

    retouch: {
        /** "auto" uses the AI inpainting service when RETOUCH_SERVICE_URL is set, else the built-in engine. */
        provider: parseChoice(env_.RETOUCH_PROVIDER, ["auto", "local", "iopaint"] as const, "auto"),
        /** Base URL of an IOPaint server (LaMa inpainting), e.g. http://127.0.0.1:8080. */
        serviceUrl: (env_.RETOUCH_SERVICE_URL?.trim() || "").replace(/\/$/, ""),
        timeoutMs: parsePositive(env_.RETOUCH_TIMEOUT_MS, 120_000),
        concurrency: Math.floor(parsePositive(env_.RETOUCH_CONCURRENCY, 2)),
        /** Longest side of the region handed to a provider. Larger selections are processed scaled down, then blended back at full size. */
        maxWorkingSize: Math.floor(parsePositive(env_.RETOUCH_MAX_WORKING_SIZE, 2048)),
    },

    /** Requests waiting for a processing slot beyond this are turned away with "busy". */
    maxQueuedJobs: Math.floor(parsePositive(env_.PROCESSING_MAX_QUEUE, 8)),
    /** Processing requests per client per 15 minutes. */
    processingRateLimit: Math.floor(parsePositive(env_.PROCESSING_RATE_LIMIT, 60)),
} as const;

export const isProduction = env.nodeEnv === "production";
