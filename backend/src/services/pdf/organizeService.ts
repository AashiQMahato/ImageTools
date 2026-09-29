import { degrees, PDFDocument } from "pdf-lib";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { safeDocumentName } from "../../utils/http.js";
import type { JobContext } from "../jobs/jobService.js";
import { loadPdf, savePdf, tooManyPages } from "./pdfDocument.js";
import { type PageRange, parsePageRanges } from "./pageRanges.js";

/** One page of the result: which source page (1-based) and how far to turn it (clockwise). */
export interface PagePlan {
    page: number;
    rotate: 0 | 90 | 180 | 270;
}

/**
 * The organizer's plan, checked: at least one page, every page in the document, quarter turns only.
 * Reordering, deleting, duplicating, rotating and extracting are all just plans.
 */
export function parsePlan(value: unknown): PagePlan[] {
    let plan: unknown;
    try {
        plan = JSON.parse(String(value ?? ""));
    } catch {
        throw new AppError("The page arrangement couldn't be read. Please try again.", 400, "INVALID_PAGES");
    }
    if (!Array.isArray(plan) || !plan.length) throw new AppError("Keep at least one page.", 400, "INVALID_PAGES");
    if (plan.length > env.documents.maxPages) throw tooManyPages();
    return plan.map((entry) => {
        const { page, rotate = 0 } = (entry ?? {}) as { page?: unknown; rotate?: unknown };
        if (!Number.isInteger(page) || (page as number) < 1) throw new AppError("The page arrangement couldn't be read. Please try again.", 400, "INVALID_PAGES");
        if (![0, 90, 180, 270].includes(rotate as number)) throw new AppError("Pages can only be turned by quarter turns.", 400, "INVALID_PAGES");
        return { page: page as number, rotate: rotate as PagePlan["rotate"] };
    });
}

/** Copies the chosen pages, in the chosen order and turned as asked, into a new PDF. */
async function build(source: PDFDocument, plan: PagePlan[]) {
    const output = await PDFDocument.create();
    const copied = await output.copyPages(
        source,
        plan.map((entry) => entry.page - 1),
    );
    copied.forEach((page, index) => {
        const turn = plan[index]!.rotate;
        if (turn) page.setRotation(degrees((page.getRotation().angle + turn) % 360));
        output.addPage(page);
    });
    return output;
}

export async function organizePdf(input: { path: string; name: string }, plan: PagePlan[], context: JobContext) {
    context.progress("reading");
    const source = await loadPdf(input.path);
    const count = source.getPageCount();
    const outside = plan.find((entry) => entry.page > count);
    if (outside) throw new AppError(`This document has ${count} pages; page ${outside.page} doesn't exist.`, 400, "INVALID_PAGES");
    context.progress("arranging", 0, plan.length);
    const output = await build(source, plan);
    context.progress("saving", plan.length, plan.length);
    const path = context.workspace.file("pdf");
    const pages = await savePdf(output, path);
    await context.addFile({ name: `${safeDocumentName(input.name, "document")}.pdf`, mimeType: "application/pdf", path, pages });
    context.summary({ pages });
}

/** One PDF per range — or per page ("every"). */
export async function splitPdf(input: { path: string; name: string }, split: { mode: "every" } | { mode: "ranges"; ranges: string }, context: JobContext) {
    context.progress("reading");
    const source = await loadPdf(input.path);
    const count = source.getPageCount();
    const ranges: PageRange[] = split.mode === "every" ? Array.from({ length: count }, (_, index) => ({ start: index + 1, end: index + 1 })) : parsePageRanges(split.ranges, count);
    const base = safeDocumentName(input.name, "document");
    for (const [index, range] of ranges.entries()) {
        if (context.signal.aborted) return;
        context.progress("splitting", index, ranges.length);
        const plan = Array.from({ length: range.end - range.start + 1 }, (_, offset) => ({ page: range.start + offset, rotate: 0 as const }));
        const path = context.workspace.file("pdf");
        const pages = await savePdf(await build(source, plan), path);
        const label = range.start === range.end ? `page-${range.start}` : `pages-${range.start}-${range.end}`;
        await context.addFile({ name: `${base}-${label}.pdf`, mimeType: "application/pdf", path, pages });
    }
    context.progress("saving", ranges.length, ranges.length);
    context.summary({ documents: ranges.length, sourcePages: count });
}

/** The PDFs, one after another, as one document. */
export async function mergePdfs(inputs: { path: string; name: string }[], context: JobContext) {
    const output = await PDFDocument.create();
    for (const [index, input] of inputs.entries()) {
        if (context.signal.aborted) return;
        context.progress("merging", index, inputs.length);
        const source = await loadPdf(input.path).catch((error: unknown) => {
            // Say which file it was: with several, "this PDF" is ambiguous.
            if (error instanceof AppError) throw new AppError(`${input.name.slice(0, 80)}: ${error.message}`, error.statusCode, error.code);
            throw error;
        });
        const pages = await output.copyPages(source, source.getPageIndices());
        pages.forEach((page) => output.addPage(page));
        if (output.getPageCount() > env.documents.maxPages) throw tooManyPages();
    }
    context.progress("saving", inputs.length, inputs.length);
    const path = context.workspace.file("pdf");
    const pages = await savePdf(output, path);
    await context.addFile({ name: `${safeDocumentName(inputs[0]!.name, "document")}-merged.pdf`, mimeType: "application/pdf", path, pages });
    context.summary({ pages, documents: inputs.length });
}
