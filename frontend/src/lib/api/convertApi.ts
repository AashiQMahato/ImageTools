import { postFormForBlob, type UploadOptions } from "./apiClient";

/** A photo in a format the browser can't open (HEIC, BMP…) → an upright JPEG of it, from the server. */
export async function convertToJpeg(file: File, options?: UploadOptions): Promise<File> {
    const form = new FormData();
    form.append("file", file, file.name || "photo");
    const { blob } = await postFormForBlob("/convert", form, options);
    const name = `${(file.name || "photo").replace(/\.[^.]*$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg" });
}
