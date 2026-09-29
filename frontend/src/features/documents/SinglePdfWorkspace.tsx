import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/i18n";
import type { useSinglePdf } from "./useSinglePdf";

/** While the chosen PDF opens: a quiet loader; once open, the tool's own view. */
export function SinglePdfWorkspace({ pdf, children }: { pdf: ReturnType<typeof useSinglePdf>; children: (ready: NonNullable<ReturnType<typeof useSinglePdf>["ready"]>) => ReactNode }) {
    const t = useT();
    if (!pdf.ready) {
        return (
            <p role="status" className="flex h-full min-h-40 items-center justify-center gap-2 text-sm text-tertiary">
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                {t.documents.errors.loading}
            </p>
        );
    }
    return <>{children(pdf.ready)}</>;
}

/** The file's name and page count, above a single-PDF tool's options. */
export function PdfFileSummary({ name, pages }: { name: string; pages: number | null }) {
    const t = useT();
    return (
        <section className="flex flex-col gap-0.5">
            <h3 className="truncate text-sm font-semibold text-primary" title={name}>
                {name}
            </h3>
            {pages !== null && <p className="text-xs text-tertiary tabular-nums">{t.documents.result.pages(pages)}</p>}
        </section>
    );
}
