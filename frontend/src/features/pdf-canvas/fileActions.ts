import { downloadFile } from "@/lib/utils/download";

/** Saves a file the browser already has (nothing is uploaded). */
export function saveBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    downloadFile(url, name);
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Prints the PDF itself — every page, at full quality — through the browser's own PDF printing: the
 * file in a hidden frame, printed from there. Where a browser won't print a PDF from a frame, it
 * opens in a new tab to print from.
 */
export function printPdfBlob(blob: Blob) {
    const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    frame.setAttribute("aria-hidden", "true");
    frame.src = url;
    const cleanUp = () => {
        frame.remove();
        URL.revokeObjectURL(url);
    };
    frame.onload = () => {
        try {
            frame.contentWindow?.focus();
            frame.contentWindow?.print();
            // The print dialog blocks until closed in most browsers; the frame goes a while after.
            window.setTimeout(cleanUp, 60_000);
        } catch {
            window.open(url, "_blank", "noopener");
            window.setTimeout(cleanUp, 60_000);
        }
    };
    document.body.append(frame);
}
