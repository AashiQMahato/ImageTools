import { spawn } from "node:child_process";
import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/AppError.js";
import type { DetectedLanguage, OcrProvider, Recognition, RecognizedLine } from "../types.js";

/** Runs the tesseract binary (no shell) and collects its stdout. */
function run(args: string[], input: Buffer | null, signal: AbortSignal, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(env.ocr.tesseractPath, args, { stdio: ["pipe", "pipe", "ignore"], shell: false });
        let output = "";
        child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
        const kill = () => child.exitCode === null && child.kill("SIGKILL");
        const timer = setTimeout(kill, timeoutMs);
        signal.addEventListener("abort", kill, { once: true });
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            signal.removeEventListener("abort", kill);
            code === 0 ? resolve(output) : reject(new Error(`tesseract exited ${code}`));
        });
        child.stdin.end(input ?? undefined);
    });
}

let languages: Promise<Set<string>> | null = null;
/** The trained languages installed with tesseract (e.g. eng, nep), checked once. */
const installed = () =>
    (languages ??= run(["--list-langs"], null, new AbortController().signal, 5000)
        .then((output) => new Set(output.split("\n").slice(1).map((line) => line.trim()).filter(Boolean)))
        .catch(() => new Set<string>()));

/**
 * Tesseract, as a fallback when PaddleOCR isn't installed: word boxes and confidence from its TSV
 * output, grouped into its own lines. It has no layout model, so layout comes from geometry alone.
 */
export const tesseractProvider: OcrProvider = {
    name: "tesseract",
    layoutAware: false,
    isAvailable: async () => (await installed()).has("eng"),
    async recognize(image, { language }, signal) {
        const have = await installed();
        const wanted = language === "en" ? ["eng"] : language === "ne" ? ["nep"] : ["eng", "nep"];
        const langs = wanted.filter((lang) => have.has(lang));
        if (!langs.length) throw new AppError("This language isn't installed for text recognition on this server.", 503, "OCR_UNAVAILABLE");
        let tsv: string;
        try {
            tsv = await run(["stdin", "stdout", "-l", langs.join("+"), "--psm", "3", "tsv"], image, signal, env.ocr.timeoutMs);
        } catch {
            if (signal.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
            throw new AppError("We couldn't read the text in this image. Please try again.", 502, "PROCESSING_FAILED");
        }

        const lines = new Map<string, RecognizedLine>();
        let width = 0;
        let height = 0;
        for (const row of tsv.split("\n").slice(1)) {
            const cells = row.split("\t");
            if (cells.length < 12) continue;
            const [level, , block, paragraph, line, , left, top, w, h, conf, ...rest] = cells;
            const text = rest.join("\t").trim();
            if (level === "1") {
                width = Number(w);
                height = Number(h);
            }
            if (level !== "5" || !text) continue;
            const key = `${block}.${paragraph}.${line}`;
            const box = { x: Number(left), y: Number(top), width: Number(w), height: Number(h) };
            const confidence = Math.max(0, Number(conf)) / 100;
            const entry = lines.get(key) ?? { text: "", confidence: 0, box, textHeight: 0, words: [] };
            entry.words.push({ text, box, confidence });
            lines.set(key, entry);
        }
        const result: RecognizedLine[] = [...lines.values()].map((line) => {
            const xs = line.words.map((word) => word.box.x);
            const ys = line.words.map((word) => word.box.y);
            const right = Math.max(...line.words.map((word) => word.box.x + word.box.width));
            const bottom = Math.max(...line.words.map((word) => word.box.y + word.box.height));
            return {
                text: line.words.map((word) => word.text).join(" "),
                confidence: line.words.reduce((sum, word) => sum + word.confidence, 0) / line.words.length,
                box: { x: Math.min(...xs), y: Math.min(...ys), width: right - Math.min(...xs), height: bottom - Math.min(...ys) },
                textHeight: bottom - Math.min(...ys),
                words: line.words,
            };
        });
        const text = result.map((line) => line.text).join(" ");
        const devanagari = (text.match(/[ऀ-ॿ]/g) ?? []).length;
        const latin = (text.match(/[A-Za-z]/g) ?? []).length;
        const detected: DetectedLanguage = !devanagari && !latin ? "unknown" : devanagari && latin / (devanagari + latin) > 0.15 ? "mixed" : devanagari ? "ne" : "en";
        const recognition: Recognition = { width, height, language: detected, lines: result, regions: [] };
        return recognition;
    },
};
