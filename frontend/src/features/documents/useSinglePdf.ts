import { useCallback, useEffect, useState } from "react";
import { closePdfDocument, isPdfFile } from "@/lib/pdf/pdfjs";
import { useT } from "@/i18n";
import { MAX_PDF_MB } from "./limits";
import { usePdfFile } from "./usePdfFile";

/**
 * The one PDF a tool works on: the first PDF picked, dropped or pasted — checked (type, size) and
 * opened for previews. Replacing or clearing it frees the old one. `allowLocked`: a password-protected
 * PDF is kept (without previews) rather than refused — for unlocking it.
 */
export function useSinglePdf({ allowLocked = false }: { allowLocked?: boolean } = {}) {
    const t = useT();
    const [chosen, setChosen] = useState<{ file: File; id: string } | null>(null);
    const file = chosen?.file ?? null;
    const [problem, setProblem] = useState<string | null>(null);
    const preview = usePdfFile(file);

    useEffect(() => {
        if (!file) return;
        return () => closePdfDocument(file);
    }, [file]);

    const receive = useCallback(
        (files: File[]) => {
            const pdf = files.find(isPdfFile);
            if (!pdf) return setProblem(t.documents.errors.notPdf);
            if (pdf.size > MAX_PDF_MB * 1024 * 1024) return setProblem(t.documents.errors.tooLarge(MAX_PDF_MB));
            setProblem(null);
            setChosen({ file: pdf, id: crypto.randomUUID() });
        },
        [t],
    );
    const clear = useCallback(() => {
        setChosen(null);
        setProblem(null);
    }, []);

    // A PDF that can't be opened (locked, damaged) isn't kept: back to the drop zone, with the reason.
    const locked = allowLocked && preview?.status === "error" && preview.problem === "locked";
    const failed = preview?.status === "error" && !locked;
    const openProblem = failed ? t.documents.errors[preview.problem] : null;
    return { file: failed ? null : file, id: chosen?.id ?? null, preview, receive, clear, problem: problem ?? openProblem, ready: preview?.status === "ready" ? preview : null, locked };
}
