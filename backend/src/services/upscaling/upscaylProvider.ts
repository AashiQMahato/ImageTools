import { spawn } from "node:child_process";
import { access, constants, readFile, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "../../config/env.js";
import type { ImageInput, ImageOutput, ProcessingContext, UpscaleOptions, UpscaleProvider } from "../../types/image.js";
import { AppError } from "../../utils/AppError.js";
import { withTempDir } from "../../utils/tempDir.js";
import { encodeLike } from "../image-processing/encode.js";

export type UpscaylStatus = "disabled" | "checking" | "ready" | "unavailable";
export type UpscaylReason = "disabled" | "binary-missing" | "model-missing" | "gpu-unavailable" | null;

const REASON_MESSAGES: Record<Exclude<UpscaylReason, null>, string> = {
    disabled: "Upscaling is turned off on this server.",
    "binary-missing": "Upscaling isn't set up on this server yet.",
    "model-missing": "Upscaling isn't set up on this server yet.",
    "gpu-unavailable": "Upscaling is unavailable on this server because compatible GPU acceleration is not available.",
};

/** Model names become a file name inside the models directory, so only plain slugs are accepted. */
const MODEL_NAME = /^[a-z0-9][a-z0-9-]*$/;

interface RunResult {
    code: number | null;
    output: string;
    timedOut: boolean;
    aborted: boolean;
}

/**
 * Runs upscayl-bin with a fixed argument array (no shell). The process is killed on timeout or when the
 * caller aborts, and is always awaited, so no orphaned GPU process is left behind.
 */
function runUpscayl(args: string[], timeoutMs: number, signal?: AbortSignal): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(env.upscayl.binaryPath, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
        let output = "";
        let timedOut = false;
        let aborted = false;
        const collect = (chunk: Buffer) => {
            if (output.length < 16_384) output += chunk.toString();
        };
        child.stdout.on("data", collect);
        child.stderr.on("data", collect);

        const kill = () => {
            if (child.exitCode === null) child.kill("SIGKILL");
        };
        const timer = setTimeout(() => {
            timedOut = true;
            kill();
        }, timeoutMs);
        const onAbort = () => {
            aborted = true;
            kill();
        };
        signal?.addEventListener("abort", onAbort, { once: true });

        child.on("error", (error) => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            signal?.removeEventListener("abort", onAbort);
            resolve({ code, output, timedOut, aborted });
        });
    });
}

class UpscaylProvider implements UpscaleProvider {
    readonly name = "upscayl-ncnn";
    private status: UpscaylStatus = "checking";
    private reason: UpscaylReason = null;
    private gpu: string | null = null;

    get state() {
        return { status: this.status, reason: this.reason, gpu: this.gpu, model: env.upscayl.model };
    }

    get unavailableMessage() {
        return this.reason ? REASON_MESSAGES[this.reason] : "Upscaling is temporarily unavailable.";
    }

    isAvailable() {
        return this.status === "ready";
    }

    /** Verify the binary, the model files and — by upscaling a tiny image — that a Vulkan GPU actually works. */
    async probe() {
        this.status = "checking";
        const set = (status: UpscaylStatus, reason: UpscaylReason) => {
            this.status = status;
            this.reason = reason;
            if (reason) console.warn(`Upscaling unavailable: ${reason}`);
        };

        if (!env.upscayl.enabled) return set("disabled", "disabled");
        try {
            await access(env.upscayl.binaryPath, constants.X_OK);
        } catch {
            return set("unavailable", "binary-missing");
        }
        if (!MODEL_NAME.test(env.upscayl.model) || !(await this.modelInstalled(env.upscayl.model))) {
            return set("unavailable", "model-missing");
        }

        try {
            await withTempDir(async (dir) => {
                const input = path.join(dir, "probe.png");
                const output = path.join(dir, "probe-out.png");
                await sharp({ create: { width: 16, height: 16, channels: 3, background: "#7a5a3c" } }).png().toFile(input);
                const result = await runUpscayl(this.args(input, output, 2), 60_000);
                const size = await stat(output).then((s) => s.size).catch(() => 0);
                if (result.code !== 0 || size === 0) throw new Error("probe failed");
                // upscayl-bin logs the device as "[0 <GPU name>]  queueC=…".
                this.gpu = /^\[\d+ ([^\]]+)\]/m.exec(result.output)?.[1]?.trim() ?? null;
            });
        } catch {
            return set("unavailable", "gpu-unavailable");
        }

        set("ready", null);
        console.log(`Upscaling ready (model: ${env.upscayl.model}${this.gpu ? `, GPU: ${this.gpu}` : ""}).`);
    }

    async upscale(input: ImageInput, { scale }: UpscaleOptions, { signal }: ProcessingContext): Promise<ImageOutput> {
        if (!this.isAvailable()) throw new AppError(this.unavailableMessage, 503, "UPSCALING_UNAVAILABLE");

        if (input.width * input.height * scale * scale > env.upscayl.maxOutputPixels) {
            const maxSide = Math.floor(Math.sqrt(env.upscayl.maxOutputPixels) / scale);
            throw new AppError(
                `This image is too large to upscale ${scale}×. ${scale === 4 ? "Try 2×, or use" : "Use"} an image up to about ${maxSide} × ${maxSide} pixels.`,
                413,
                "IMAGE_TOO_LARGE",
            );
        }

        return withTempDir(async (dir) => {
            const inputPath = path.join(dir, "input.png");
            const outputPath = path.join(dir, "output.png");

            // Normalise to PNG with EXIF orientation applied (upscayl-bin ignores EXIF), keeping any alpha channel.
            await sharp(input.buffer, { limitInputPixels: env.maxImagePixels }).rotate().png({ compressionLevel: 1 }).toFile(inputPath);

            let result: RunResult;
            try {
                result = await runUpscayl(this.args(inputPath, outputPath, scale), env.upscayl.timeoutMs, signal);
            } catch {
                throw new AppError("Upscaling failed. Please try again.", 502, "PROCESSING_FAILED");
            }
            if (result.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
            if (result.timedOut) {
                throw new AppError(`Upscaling took too long. Please try a smaller image${scale === 4 ? " or 2×" : ""}.`, 504, "PROCESSING_TIMEOUT");
            }

            const raw = await readFile(outputPath).catch(() => null);
            if (result.code !== 0 || !raw) {
                console.error(`upscayl-bin exited with ${result.code}`);
                throw new AppError("Upscaling failed. Please try again.", 502, "PROCESSING_FAILED");
            }

            return encodeLike(sharp(raw, { limitInputPixels: false }), input);
        });
    }

    private args(input: string, output: string, scale: number): string[] {
        return ["-i", input, "-o", output, "-m", env.upscayl.modelsDir, "-n", env.upscayl.model, "-s", String(scale), "-f", "png"];
    }

    private async modelInstalled(model: string) {
        const files = [`${model}.param`, `${model}.bin`].map((name) => path.join(env.upscayl.modelsDir, name));
        const sizes = await Promise.all(files.map((file) => stat(file).then((s) => s.size).catch(() => 0)));
        return sizes.every((size) => size > 0);
    }
}

export const upscaylProvider = new UpscaylProvider();
