import { LoaderCircle } from "lucide-react";
import type { PdfPreview } from "./usePdfFile";
import { PageThumbnail } from "./PageThumbnail";

/** A PDF's first page, for file cards. */
export function PdfCover({ preview, label }: { preview: PdfPreview | null; label: string }) {
    if (preview?.status !== "ready") {
        return <span className="grid size-full place-items-center">{preview?.status === "loading" && <LoaderCircle className="size-5 animate-spin text-quaternary motion-reduce:animate-none" aria-hidden />}</span>;
    }
    return (
        <span className="grid size-full place-items-center p-2">
            <PageThumbnail document={preview.document} page={1} size={preview.sizes[0]!} width={180} label={label} className="max-h-full" />
        </span>
    );
}
