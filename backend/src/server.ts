import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.port, () => {
    console.log(`Image Tools API listening on http://localhost:${env.port}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
        console.error(
            `Port ${env.port} is already in use. On macOS, port 5000 is taken by AirPlay Receiver — ` +
                "disable it in System Settings → General → AirDrop & Handoff, or set a different PORT in .env.",
        );
    } else {
        console.error(error);
    }
    process.exit(1);
});

function shutdown(signal: string) {
    console.log(`${signal} received, shutting down...`);
    server.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
