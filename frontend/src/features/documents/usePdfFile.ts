import type { PDFDocumentProxy } from "pdfjs-dist";
import { useEffect, useState } from "react";
import { openPdfDocument, PdfOpenError, type PdfOpenProblem, pageSizes } from "@/lib/pdf/pdfjs";

export type PdfPreview = { status: "loading" } | { status: "ready"; document: PDFDocumentProxy; sizes: { width: number; height: number }[] } | { status: "error"; problem: PdfOpenProblem };

const LOADING: PdfPreview = { status: "loading" };

/** A PDF opened in the browser for previews: its pages and their sizes. (Stable objects: safe as effect dependencies.) */
export function usePdfFile(file: Blob | null): PdfPreview | null {
    const [preview, setPreview] = useState<{ file: Blob; value: PdfPreview } | null>(null);
    useEffect(() => {
        if (!file) return;
        let live = true;
        void (async () => {
            try {
                const document = await openPdfDocument(file);
                const sizes = await pageSizes(document);
                if (live) setPreview({ file, value: { status: "ready", document, sizes } });
            } catch (error) {
                if (live) setPreview({ file, value: { status: "error", problem: error instanceof PdfOpenError ? error.problem : "unreadable" } });
            }
        })();
        return () => {
            live = false;
        };
    }, [file]);
    if (!file) return null;
    return preview?.file === file ? preview.value : LOADING;
}
