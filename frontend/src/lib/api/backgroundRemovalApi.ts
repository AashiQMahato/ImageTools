import { type BinaryResult, postFormForBlob, type UploadOptions } from "./apiClient";

/** Sends the image to our API and resolves with the transparent PNG. */
export function removeBackground(image: File, options?: UploadOptions): Promise<BinaryResult> {
    const form = new FormData();
    form.append("file", image);
    return postFormForBlob("/remove-background", form, options);
}
