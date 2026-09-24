import type { BackgroundRemovalResult } from "@/types/image";
import { apiClient } from "./apiClient";

export function removeBackground(image: File, signal?: AbortSignal): Promise<BackgroundRemovalResult> {
    const formData = new FormData();
    formData.append("image", image);
    return apiClient.post<BackgroundRemovalResult>("/remove-background", formData, { signal });
}
