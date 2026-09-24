import type { UpscaleFactor } from "@/types/image";
import { type BinaryResult, postFormForBlob, type UploadOptions } from "./apiClient";

export function upscaleImage(image: File, scale: UpscaleFactor, options?: UploadOptions): Promise<BinaryResult> {
    const form = new FormData();
    form.append("scale", String(scale));
    form.append("file", image);
    return postFormForBlob("/upscale", form, options);
}
