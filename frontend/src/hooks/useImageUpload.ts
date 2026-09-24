import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AppRoute, ROUTES } from "@/lib/constants/routes";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants/upload";
import { useImageStore } from "@/store/useImageStore";
import type { ImageDimensions } from "@/types/image";

const acceptedTypes: readonly string[] = ACCEPTED_IMAGE_TYPES;

function validate(file: File): string | null {
    if (!acceptedTypes.includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
    if (file.size > MAX_UPLOAD_BYTES) return "That image is larger than 10 MB. Please choose a smaller one.";
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

    const openPicker = useCallback(() => {
        setError(null);
        inputRef.current?.click();
    }, []);

    const acceptFile = useCallback(
        async (file: File) => {
            const problem = validate(file);
            if (problem) {
                setError(problem);
                return false;
            }
            let dimensions: ImageDimensions;
            try {
                dimensions = await readDimensions(file);
            } catch {
                setError("This file couldn't be read as an image. It may be damaged.");
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
        [navigate, navigateTo, setOriginal],
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
