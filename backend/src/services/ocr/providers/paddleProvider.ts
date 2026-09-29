import { existsSync } from "node:fs";
import { env } from "../../../config/env.js";
import { AppError } from "../../../utils/AppError.js";
import { fetchBuffered } from "../../../utils/fetchBuffered.js";
import { PythonService } from "../../../utils/pythonService.js";
import type { Box, LayoutRegion, OcrProvider, Recognition, RecognizedLine, RecognizedWord } from "../types.js";

/** The PaddleOCR service. Started on the first OCR request (it takes ~1 GB of memory), then kept. */
export const ocrProcess = new PythonService({
    name: "Text recognition (PaddleOCR)",
    tag: "[ocr]",
    pythonPath: () => env.ocr.pythonPath,
    cwd: () => env.ocr.serviceDir,
    setupHint: "Run scripts/setup-ml.sh.",
    env: () => ({
        PADDLE_PDX_CACHE_HOME: env.ocr.modelsDir,
        // Models come from the official sources; skipping the reachability probe saves seconds per start.
        PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK: "True",
        MAX_IMAGE_SIZE_MB: String(env.maxImageSizeMb * 2),
        MAX_IMAGE_PIXELS: String(env.maxImagePixels),
        // Model choices, only when the operator set them (the service has its own defaults).
        ...Object.fromEntries(
            ["OCR_DETECTION_MODEL", "OCR_ENGLISH_MODEL", "OCR_DEVANAGARI_MODEL", "OCR_LAYOUT_MODEL", "OCR_ORIENTATION_MODEL"].flatMap((key) => (process.env[key] ? [[key, process.env[key]!]] : [])),
        ),
    }),
});

const unavailable = () => new AppError("Text recognition is temporarily unavailable. Please try again in a moment.", 503, "OCR_UNAVAILABLE");

const toBox = ([x, y, width, height]: number[]): Box => ({ x: x!, y: y!, width: width!, height: height! });

/** Height of a line's quadrilateral (top-left, top-right, bottom-right, bottom-left): its two short sides. */
function quadHeight(quad: [number, number][] | undefined) {
    if (!quad || quad.length !== 4) return null;
    const [a, b, c, d] = quad as [[number, number], [number, number], [number, number], [number, number]];
    return (Math.hypot(d[0] - a[0], d[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1])) / 2;
}

/**
 * Devanagari recognition returns a whole line as one "word". Split it at spaces and give each word a
 * share of the line's width by its length — marked approximate, since it isn't measured.
 */
function splitWords(line: { text: string; box: Box; confidence: number }, words: RecognizedWord[]): RecognizedWord[] {
    if (words.length > 1 || !line.text.includes(" ")) return words.length ? words : [{ text: line.text.trim(), box: line.box, confidence: line.confidence }];
    const parts = line.text.trim().split(/\s+/);
    const total = parts.reduce((sum, part) => sum + [...part].length, 0) + (parts.length - 1);
    let offset = 0;
    return parts.map((part) => {
        const length = [...part].length;
        const word = { text: part, box: { x: line.box.x + (offset / total) * line.box.width, y: line.box.y, width: (length / total) * line.box.width, height: line.box.height }, confidence: line.confidence, approximate: true };
        offset += length + 1;
        return word;
    });
}

export const paddleProvider: OcrProvider = {
    name: "paddleocr",
    layoutAware: true,
    isAvailable: async () => existsSync(env.ocr.pythonPath),
    async recognize(image, { language, layout }, signal) {
        const connection = await ocrProcess.ensureReady();
        if (!connection) throw unavailable();
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(image)]), "page.png");
        form.append("language", language);
        form.append("layout_analysis", String(layout));
        let response: Response;
        try {
            response = await fetchBuffered(`${connection.url}/ocr`, {
                method: "POST",
                body: form,
                headers: { "x-internal-token": connection.token },
                signal: AbortSignal.any([signal, AbortSignal.timeout(env.ocr.timeoutMs)]),
            });
        } catch (error) {
            if (signal.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
            if (error instanceof Error && error.name === "TimeoutError") throw new AppError("Reading the text took too long. Try a smaller image or select a region.", 504, "PROCESSING_TIMEOUT");
            throw unavailable();
        }
        if (!response.ok) {
            const body = (await response.json().catch(() => null)) as { code?: string } | null;
            if (body?.code === "INVALID_IMAGE") throw new AppError("This file couldn't be read as an image. It may be damaged.", 422, "INVALID_IMAGE");
            if (response.status === 503) throw unavailable();
            throw new AppError("We couldn't read the text in this image. Please try again.", 502, "PROCESSING_FAILED");
        }
        const body = (await response.json()) as {
            width: number;
            height: number;
            language: Recognition["language"];
            lines: { text: string; confidence: number; box: number[]; polygon: [number, number][]; words: { text: string; box: number[] }[] }[];
            regions: { label: string; score: number; box: number[] }[];
        };
        const lines: RecognizedLine[] = body.lines.map((line) => {
            const base = { text: line.text, box: toBox(line.box), confidence: line.confidence };
            return { ...base, textHeight: quadHeight(line.polygon) ?? base.box.height, words: splitWords(base, line.words.map((word) => ({ text: word.text.trim(), box: toBox(word.box), confidence: line.confidence }))) };
        });
        const regions: LayoutRegion[] = body.regions.map((region) => ({ label: region.label, score: region.score, box: toBox(region.box) }));
        return { width: body.width, height: body.height, language: body.language, lines, regions };
    },
    async detectOrientation(image, signal) {
        const connection = await ocrProcess.ensureReady();
        if (!connection) throw unavailable();
        const form = new FormData();
        form.append("file", new Blob([new Uint8Array(image)]), "page.png");
        try {
            const response = await fetchBuffered(`${connection.url}/orientation`, {
                method: "POST",
                body: form,
                headers: { "x-internal-token": connection.token },
                signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
            });
            if (!response.ok) return 0;
            const { angle } = (await response.json()) as { angle: number };
            return [90, 180, 270].includes(angle) ? angle : 0;
        } catch {
            if (signal.aborted) throw new AppError("The request was cancelled.", 499, "REQUEST_CANCELLED");
            // Not knowing is not an error: the page is read as it is.
            return 0;
        }
    },
};
