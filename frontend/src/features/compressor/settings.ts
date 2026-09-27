import type { CompressSettings, QualityPreset } from "@/lib/api/compressApi";

/** The level's own quality, shown on the slider until it's moved (mirrors the server's presets). */
export const PRESET_QUALITY: Record<QualityPreset, number> = { maximum: 92, high: 84, balanced: 74, small: 60, minimum: 45 };

export const DEFAULT_SETTINGS: CompressSettings = { preset: "balanced", quality: null, format: "auto", target: null, maxSide: null, stripMetadata: true, progressive: true };

/** "500 KB", "1.5 MB" — a target as the user set it. */
export const formatTarget = (target: NonNullable<CompressSettings["target"]>) => `${target.size} ${target.unit}`;
