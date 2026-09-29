import type { OcrLanguage, OcrRegion } from "@/lib/api/ocrApi";

export type RegionTool = "full" | "rect" | "free";

export interface ReadSettings {
    language: OcrLanguage;
    tool: RegionTool;
    region: OcrRegion | null;
    detectLayout: boolean;
}

export const DEFAULT_SETTINGS: ReadSettings = { language: "auto", tool: "full", region: null, detectLayout: true };
