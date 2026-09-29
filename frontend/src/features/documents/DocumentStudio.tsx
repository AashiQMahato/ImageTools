import type { ComponentProps } from "react";
import { StudioShell } from "@/components/studio/StudioShell";
import { ImageStoreContext, useNoImageStore } from "@/store/useImageStore";

/**
 * The studio frame for document tools. They manage their own files (PDFs, several images), so the
 * shared working image is neither shown nor replaced here; picked, dropped or pasted files come to
 * `onFiles`.
 */
export function DocumentStudio(props: ComponentProps<typeof StudioShell> & { onFiles: (files: File[]) => void; accept: string }) {
    return (
        <ImageStoreContext.Provider value={useNoImageStore}>
            <StudioShell mobilePanel="stack" {...props} />
        </ImageStoreContext.Provider>
    );
}
