import type { PDFDocumentProxy } from "pdfjs-dist";

/** pdf.js is large: loaded only when a PDF is actually opened, with its worker alongside. */
export async function pdfjs() {
    const [library, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    library.GlobalWorkerOptions.workerSrc = worker.default;
    return library;
}

export type PdfOpenProblem = "locked" | "unreadable";
export class PdfOpenError extends Error {
    readonly problem: PdfOpenProblem;
    constructor(problem: PdfOpenProblem) {
        super(problem);
        this.problem = problem;
    }
}

export const isPdfFile = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

const documents = new WeakMap<Blob, Promise<PDFDocumentProxy>>();

/**
 * A PDF opened for viewing in this browser (previews, thumbnails) — the file's own bytes, nothing
 * fetched, no scripts run. Each file is parsed once, however many views use it.
 */
export function openPdfDocument(file: Blob): Promise<PDFDocumentProxy> {
    let pending = documents.get(file);
    if (!pending) {
        pending = (async () => {
            const library = await pdfjs();
            try {
                return await library.getDocument({ data: new Uint8Array(await file.arrayBuffer()), enableXfa: false }).promise;
            } catch (error) {
                throw new PdfOpenError(error instanceof library.PasswordException ? "locked" : "unreadable");
            }
        })();
        pending.catch(() => documents.delete(file));
        documents.set(file, pending);
    }
    return pending;
}

/** Frees a document's memory once nothing shows it any more. */
export function closePdfDocument(file: Blob) {
    const pending = documents.get(file);
    documents.delete(file);
    void pending?.then((document) => document.loadingTask.destroy()).catch(() => undefined);
}

/** Page sizes (points, as displayed — the page's own rotation applied). */
export async function pageSizes(document: PDFDocumentProxy): Promise<{ width: number; height: number }[]> {
    const sizes: { width: number; height: number }[] = [];
    for (let page = 1; page <= document.numPages; page++) {
        const viewport = (await document.getPage(page)).getViewport({ scale: 1 });
        sizes.push({ width: viewport.width, height: viewport.height });
    }
    return sizes;
}
