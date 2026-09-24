import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AppRoute, ROUTES } from "@/lib/constants/routes";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants/upload";
import { useImageStore } from "@/store/useImageStore";
import type { ImageDimensions } from "@/types/image";
import { type Dictionary, useT } from "@/i18n";

const acceptedTypes: readonly string[] = ACCEPTED_IMAGE_TYPES;

function validate(file: File, t: Dictionary): string | null {
    if (!acceptedTypes.includes(file.type)) return t.upload.wrongType;
    if (file.size > MAX_UPLOAD_BYTES) return t.upload.tooLarge;
    return null;
}

/** Decode the image once to learn its size — this also proves the browser can actually read it. */
async function readDimensions(file: File): Promise<ImageDimensions> {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
}

interface Options {
    /** Where to go after a successful pick. `null` stays on the current page. */
    navigateTo?: AppRoute | null;
}

/**
 * The one way images enter the app (file picker, drag and drop, landing CTA):
 * validates type and size (mirroring the API), decodes it, stores it and optionally opens a tool.
 */
export function useImageUpload({ navigateTo = ROUTES.removeBackground }: Options = {}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const setOriginal = useImageStore((state) => state.setOriginal);
    const navigate = useNavigate();
    const t = useT();

    const openPicker = useCallback(() => {
        setError(null);
        inputRef.current?.click();
    }, []);

    const acceptFile = useCallback(
        async (file: File) => {
            const problem = validate(file, t);
            if (problem) {
                setError(problem);
                return false;
            }
            let dimensions: ImageDimensions;
            try {
                dimensions = await readDimensions(file);
            } catch {
                setError(t.upload.unreadable);
                return false;
            }

            setError(null);
            setOriginal({
                id: crypto.randomUUID(),
                file,
                name: file.name,
                size: file.size,
                mimeType: file.type,
                previewUrl: URL.createObjectURL(file),
                dimensions,
            });
            if (navigateTo) navigate(navigateTo);
            return true;
        },
        [navigate, navigateTo, setOriginal, t],
    );

    const onChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = ""; // allow picking the same file again
            if (file) void acceptFile(file);
        },
        [acceptFile],
    );

    const inputProps = {
        ref: inputRef,
        type: "file",
        accept: ACCEPTED_IMAGE_TYPES.join(","),
        onChange,
        hidden: true,
        tabIndex: -1,
    } as const;

    return { openPicker, acceptFile, inputProps, error, setError, clearError: () => setError(null) };
}
