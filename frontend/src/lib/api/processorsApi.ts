import { apiClient } from "./apiClient";

export interface ProcessorHealth {
    backgroundRemoval: { available: boolean; status: string };
    upscaling: { available: boolean; status: string; message: string | null; scales: number[] };
    limits: { maxFileSizeMb: number; formats: string[] };
}

export function getProcessorHealth(signal?: AbortSignal): Promise<ProcessorHealth> {
    return apiClient.get<ProcessorHealth>("/health/processors", { signal });
}
