import sharp from "sharp";
import { env } from "../../config/env.js";
import type { ProcessingContext } from "../../types/image.js";
import { AppError } from "../../utils/AppError.js";
import { ConcurrencyLimiter } from "../../utils/concurrency.js";
import { prepareImage } from "../photo-generator/formatConversionService.js";
import { type LineInk, measureLine } from "./formattingService.js";
import { analyzeLayout } from "./layoutService.js";
import { preparePage, type Region } from "./preprocessingService.js";
import { getOcrProvider } from "./providers/index.js";
import { reconstruct } from "./reconstructionService.js";
import type { OcrDocument, OcrLanguage, OcrProvider, RecognizedLine } from "./types.js";

export type OcrStage = "prepare" | "read" | "layout" | "paragraphs" | "formatting" | "document";

export type OcrEvent = { type: "stage"; stage: OcrStage; status: "active" | "done"; detail?: Record<string, unknown> };

export interface OcrRequest {
    upload: Buffer;
    language: OcrLanguage;
    region: Region | null;
    preserveLayout: boolean;
}

/**
 * Upload → editable document. Each step is its own module; this only runs them in order and reports
 * each as it really happens (no timed or simulated progress).
 */
async function extract({ upload, language, region, preserveLayout }: OcrRequest, emit: (event: OcrEvent) => void, context: ProcessingContext): Promise<OcrDocument> {
    const { signal } = context;
    emit({ type: "stage", stage: "prepare", status: "active" });
    // Same validation and conversion as every tool: real format from the bytes, HEIC converted,
    // EXIF orientation applied. The upload itself is never modified or kept.
    const upright = await prepareImage(upload, signal, { lossless: true });
    const provider = await getOcrProvider();
    // Scans and PDF pages have no EXIF to say which way is up: the whole page is checked and turned
    // upright. (Not for a selected region — it was drawn on the page as it is.)
    const rotation = region ? 0 : await pageRotation(provider, upright.buffer, signal);
    if (rotation) {
        const turned = await sharp(upright.buffer).rotate(rotation).png({ compressionLevel: 1 }).toBuffer({ resolveWithObject: true });
        Object.assign(upright, { buffer: turned.data, width: turned.info.width, height: turned.info.height });
    }
    const page = await preparePage(upright.buffer, upright, region);
    emit({ type: "stage", stage: "prepare", status: "done", detail: { converted: upright.converted, sourceFormat: upright.sourceFormat, rotated: upright.orientationCorrected, turned: rotation, ...page.steps } });

    emit({ type: "stage", stage: "read", status: "active" });
    const recognition = await provider.recognize(page.ocr, { language, layout: preserveLayout && provider.layoutAware }, signal);
    if (!recognition.lines.length) throw new AppError("No readable text was detected. Try uploading a clearer image or selecting a smaller text region.", 422, "NO_TEXT");
    emit({ type: "stage", stage: "read", status: "done", detail: { language: recognition.language, lines: recognition.lines.length } });

    emit({ type: "stage", stage: "layout", status: "active" });
    const groups = analyzeLayout(recognition);
    emit({ type: "stage", stage: "layout", status: "done", detail: { regions: recognition.regions.length, blocks: groups.length } });

    emit({ type: "stage", stage: "paragraphs", status: "active" });
    const kinds = groups.reduce<Record<string, number>>((count, group) => ({ ...count, [group.kind]: (count[group.kind] ?? 0) + 1 }), {});
    emit({ type: "stage", stage: "paragraphs", status: "done", detail: kinds });

    emit({ type: "stage", stage: "formatting", status: "active" });
    const measured = new Map<RecognizedLine, LineInk | null>();
    for (const group of groups) for (const line of group.lines) measured.set(line, measureLine(page.colour, line.box));
    emit({ type: "stage", stage: "formatting", status: "done" });

    emit({ type: "stage", stage: "document", status: "active" });
    const size = page.region ? { width: page.region.width, height: page.region.height } : { width: upright.width, height: upright.height };
    const document = reconstruct(recognition, groups, page, measured, size, provider.name, provider.layoutAware);
    document.document.rotation = rotation;
    emit({ type: "stage", stage: "document", status: "done" });
    return document;
}

/** Clockwise degrees that turn the page upright, from a small copy (orientation doesn't need detail). */
async function pageRotation(provider: OcrProvider, image: Buffer, signal: AbortSignal): Promise<0 | 90 | 180 | 270> {
    if (!provider.detectOrientation) return 0;
    const small = await sharp(image).resize(1024, 1024, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const turned = await provider.detectOrientation(small, signal);
    // The content is turned `turned` degrees clockwise; turning it back the rest of the way puts it upright.
    return turned ? ((360 - turned) as 90 | 180 | 270) : 0;
}

const limiter = new ConcurrencyLimiter(env.ocr.concurrency, env.maxQueuedJobs);

export const ocr = {
    extract: (request: OcrRequest, emit: (event: OcrEvent) => void, context: ProcessingContext) => limiter.run(() => extract(request, emit, context), context.signal),
};
