import { type ChangeEvent, useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AppRoute, ROUTES } from "@/lib/constants/routes";
import { ApiError } from "@/lib/api/apiClient";
import { convertToJpeg } from "@/lib/api/convertApi";
import { ACCEPTED_IMAGE_TYPES, CONVERTIBLE_EXTENSIONS, CONVERTIBLE_IMAGE_TYPES, MAX_UPLOAD_BYTES, UPLOAD_ACCEPT } from "@/lib/constants/upload";
import { useImageStore } from "@/store/useImageStore";
import type { ImageDimensions } from "@/types/image";
import { type Dictionary, useT } from "@/i18n";

const acceptedTypes: readonly string[] = ACCEPTED_IMAGE_TYPES;
const convertibleTypes: readonly string[] = CONVERTIBLE_IMAGE_TYPES;

const extensionOf = (file: File) => file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
const FORMAT_NAMES: Record<string, string> = { ".heic": "HEIC", ".heif": "HEIF", ".avif": "AVIF", ".tif": "TIFF", ".tiff": "TIFF", ".bmp": "BMP", ".gif": "GIF" };

/** "HEIC", "AVIF"… when the file must be converted before the browser can use it; null when it can be used as is. */
function conversionFor(file: File): string | null {
    if (acceptedTypes.includes(file.type)) return null;
    const extension = extensionOf(file);
    if (!convertibleTypes.includes(file.type) && !(CONVERTIBLE_EXTENSIONS as readonly string[]).includes(extension)) return null;
    return FORMAT_NAMES[extension] ?? (file.type.split("/")[1]?.replace("-sequence", "").toUpperCase() || "image");
}

function validate(file: File, t: Dictionary): string | null {
    if (!acceptedTypes.includes(file.type) && !conversionFor(file)) return t.upload.wrongType;
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
    /** What's happening to a file on its way in (e.g. "HEIC detected — converting to JPEG…"). */
    const [status, setStatus] = useState<string | null>(null);
    const setOriginal = useImageStore((state) => state.setOriginal);
    const navigate = useNavigate();
    const t = useT();

    const openPicker = useCallback(() => {
        setError(null);
        inputRef.current?.click();
    }, []);

    const acceptFile = useCallback(
        async (picked: File) => {
            const problem = validate(picked, t);
            if (problem) {
                setError(problem);
                return false;
            }
            // Phones save HEIC; nobody should have to convert it themselves. The server turns it into
            // an upright, full-quality JPEG, and everything carries on as usual.
            const convertedFrom = conversionFor(picked);
            let file = picked;
            if (convertedFrom) {
                setError(null);
                setStatus(t.upload.converting(convertedFrom));
                try {
                    file = await convertToJpeg(picked);
                } catch (cause) {
                    const code = cause instanceof ApiError ? (cause.code ?? (cause.status === 0 ? "NETWORK" : undefined)) : undefined;
                    setError(code === "NETWORK" || code === "FILE_TOO_LARGE" || code === "RATE_LIMITED" ? t.errors[code]! : t.upload.conversionFailed(convertedFrom));
                    return false;
                } finally {
                    setStatus(null);
                }
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
                ...(convertedFrom ? { convertedFrom } : {}),
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
        accept: UPLOAD_ACCEPT,
        onChange,
        hidden: true,
        tabIndex: -1,
    } as const;

    return { openPicker, acceptFile, inputProps, error, setError, status, clearError: () => setError(null) };
}
