import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/lib/constants/routes";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/constants/upload";
import { useImageStore } from "@/store/useImageStore";

const acceptedTypes: readonly string[] = ACCEPTED_IMAGE_TYPES;

function validate(file: File): string | null {
    if (!acceptedTypes.includes(file.type)) return "Please choose a JPG, PNG or WebP image.";
    if (file.size > MAX_UPLOAD_BYTES) return "That image is larger than 10 MB.";
    return null;
}

/** Opens the system file picker, validates the image, keeps it in the store and opens the editor. */
export function useImageUpload() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);
    const setOriginal = useImageStore((state) => state.setOriginal);
    const navigate = useNavigate();

    const openPicker = useCallback(() => {
        setError(null);
        inputRef.current?.click();
    }, []);

    const onChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = ""; // allow picking the same file again
            if (!file) return;

            const problem = validate(file);
            if (problem) {
                setError(problem);
                return;
            }

            setOriginal({
                id: crypto.randomUUID(),
                file,
                name: file.name,
                size: file.size,
                mimeType: file.type,
                previewUrl: URL.createObjectURL(file),
            });
            navigate(ROUTES.editor);
        },
        [navigate, setOriginal],
    );

    const inputProps = {
        ref: inputRef,
        type: "file",
        accept: ACCEPTED_IMAGE_TYPES.join(","),
        onChange,
        hidden: true,
        tabIndex: -1,
    } as const;

    return { openPicker, inputProps, error, clearError: () => setError(null) };
}
