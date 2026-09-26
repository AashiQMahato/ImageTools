import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access, constants } from "node:fs/promises";
import net from "node:net";
import { env } from "../../config/env.js";

export type RembgStatus = "disabled" | "starting" | "ready" | "unavailable";

interface Endpoint {
    url: string;
    token: string;
}

/**
 * Owns the lifecycle of the internal Python rembg service.
 * With autostart (the default), it is launched on a free localhost port with a fresh random token,
 * so only this Node process can call it. It is stopped when the API shuts down.
 */
class RembgProcess {
    private child: ChildProcess | null = null;
    private endpoint: Endpoint | null = null;
    private status: RembgStatus = "disabled";
    private reason = "";

    get state() {
        return { status: this.status, reason: this.reason, model: env.rembg.model };
    }

    get connection(): Endpoint | null {
        return this.status === "ready" ? this.endpoint : null;
    }

    async start() {
        if (!env.rembg.autostart) {
            if (!env.rembg.serviceUrl) return this.fail("REMBG_AUTOSTART is off and REMBG_SERVICE_URL is not set.");
            this.endpoint = { url: env.rembg.serviceUrl.replace(/\/$/, ""), token: env.rembg.serviceToken };
            this.status = "starting";
            return this.waitUntilReady();
        }

        try {
            await access(env.rembg.pythonPath, constants.X_OK);
        } catch {
            return this.fail("Python environment not found. Run scripts/setup-ml.sh.");
        }

        const port = await freePort();
        const token = randomBytes(32).toString("hex");
        this.endpoint = { url: `http://127.0.0.1:${port}`, token };
        this.status = "starting";

        this.child = spawn(
            env.rembg.pythonPath,
            ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", String(port), "--workers", "1", "--no-access-log", "--log-level", "warning"],
            {
                cwd: env.rembg.serviceDir,
                stdio: ["ignore", "pipe", "pipe"],
                env: {
                    PATH: process.env.PATH ?? "",
                    HOME: process.env.HOME ?? "",
                    PARENT_PID: String(process.pid),
                    INTERNAL_SERVICE_TOKEN: token,
                    REMBG_MODEL: env.rembg.model,
                    U2NET_HOME: env.rembg.modelsDir,
                    FACE_DETECTOR_MODEL: env.photoGenerator.faceModelPath,
                    MAX_IMAGE_SIZE_MB: String(env.maxImageSizeMb),
                    MAX_IMAGE_PIXELS: String(env.maxImagePixels),
                    BACKGROUND_REMOVAL_CONCURRENCY: String(env.rembg.concurrency),
                    REMBG_DECONTAMINATE: String(env.rembg.decontaminate),
                    REMBG_ALPHA_MATTING: String(env.rembg.alphaMatting),
                    ...(process.env.REMBG_PROVIDERS ? { REMBG_PROVIDERS: process.env.REMBG_PROVIDERS } : {}),
                },
            },
        );

        const forward = (chunk: Buffer) => {
            for (const line of chunk.toString().split("\n")) if (line.trim()) console.log(line.startsWith("[rembg]") ? line : `[rembg] ${line}`);
        };
        this.child.stdout?.on("data", forward);
        this.child.stderr?.on("data", forward);
        this.child.on("exit", (code, signal) => {
            this.child = null;
            if (this.status !== "disabled") this.fail(`Service exited (${signal ?? code}).`);
        });
        this.child.on("error", () => this.fail("Could not start the Python service."));

        return this.waitUntilReady();
    }

    stop() {
        this.status = "disabled";
        if (this.child && this.child.exitCode === null) this.child.kill("SIGTERM");
        this.child = null;
    }

    /** Poll the service until its model session is loaded (first launch may download the model). */
    private async waitUntilReady() {
        const deadline = Date.now() + 10 * 60_000;
        while (this.status === "starting" && Date.now() < deadline) {
            try {
                const response = await fetch(`${this.endpoint!.url}/health`, {
                    headers: { "x-internal-token": this.endpoint!.token },
                    signal: AbortSignal.timeout(3000),
                });
                if (response.ok) {
                    const body = (await response.json()) as { ready: boolean; error: string | null };
                    if (body.ready) {
                        this.status = "ready";
                        console.log(`Background removal ready (model: ${env.rembg.model}).`);
                        return;
                    }
                    if (body.error) return this.fail(`Model '${env.rembg.model}' could not be loaded (${body.error}).`);
                } else if (response.status === 401) {
                    return this.fail("The rembg service rejected our token.");
                }
            } catch {
                // Not listening yet.
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        if (this.status === "starting") this.fail("Timed out waiting for the model to load.");
    }

    private fail(reason: string) {
        this.status = "unavailable";
        this.reason = reason;
        console.warn(`Background removal unavailable: ${reason}`);
        if (this.child && this.child.exitCode === null) this.child.kill("SIGTERM");
    }
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port = typeof address === "object" && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

export const rembgProcess = new RembgProcess();
