import type { UpscaleResult, UpscaleSettings } from "@/types/image";
import { apiClient } from "./apiClient";

export function upscaleImage(image: File, settings: UpscaleSettings, signal?: AbortSignal): Promise<UpscaleResult> {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("scale", String(settings.scale));
    return apiClient.post<UpscaleResult>("/upscale", formData, { signal });
}
