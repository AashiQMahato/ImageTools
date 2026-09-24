import "dotenv/config";

function parsePort(value: string | undefined, fallback: number): number {
    const port = Number(value);
    return Number.isInteger(port) && port > 0 ? port : fallback;
}

function parseOrigins(value: string | undefined): string[] {
    return (value ?? "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export const env = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parsePort(process.env.PORT, 5000),
    /** Allowed CORS origins. FRONTEND_URL may be a comma-separated list. */
    frontendOrigins: parseOrigins(process.env.FRONTEND_URL),
    removeBgApiKey: process.env.REMOVE_BG_API_KEY ?? "",
    upscaleApiKey: process.env.UPSCALE_API_KEY ?? "",
} as const;

export const isProduction = env.nodeEnv === "production";
