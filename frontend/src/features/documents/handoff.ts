import { fetchJobFile, type Job } from "@/lib/api/jobsApi";
import type { ToolKey } from "@/lib/constants/navigation";

export type HandoffKind = "pdf" | "pdfs" | "images" | "image";

/** Where each kind of result can go next, most useful first. */
export const NEXT: Record<HandoffKind, readonly ToolKey[]> = {
    pdf: ["pdfEditor", "pdfSign", "pdfCompress", "pdfToWord", "pdfProtect", "pdfViewer", "pdfOrganize", "pdfMerge", "pdfWatermark", "pdfPageNumbers", "pdfSplit", "pdfRotate", "pdfToImages", "pdfToText", "ocr"],
    pdfs: ["pdfMerge"],
    images: ["imagesToPdf", "compressor"],
    image: ["imagesToPdf", "ocr", "compressor", "editor", "removeBackground", "upscaler", "crop"],
};

/** What a job's files are, for handing on (null: nothing sensible to hand on, e.g. a locked PDF). */
export function jobHandoffKind(job: Job): HandoffKind | null {
    if (job.operation === "protect" || !job.files.length) return null;
    if (job.files.every((file) => file.mimeType === "application/pdf")) return job.files.length === 1 ? "pdf" : "pdfs";
    if (job.files.every((file) => file.mimeType.startsWith("image/"))) return job.files.length === 1 ? "image" : "images";
    return null;
}

/** A job's result files, fetched into the browser as files the next tool can open. */
export const jobFiles = (job: Job) => () => Promise.all(job.files.map(async (file) => new File([await fetchJobFile(job.id, file.id)], file.name, { type: file.mimeType })));
