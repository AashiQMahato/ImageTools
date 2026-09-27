import { Bandage, Brush, Droplets, Eraser, Focus, Hand, Lasso, type LucideIcon, SquareDashed, SunMedium, WandSparkles } from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { RetouchMode } from "@/lib/api/retouchApi";

export interface ModeConfig {
    id: RetouchMode;
    icon: LucideIcon;
    /** Has a strength setting (filling modes simply rebuild the area). */
    strength: boolean;
    /** Has a keep-texture setting. */
    texture: boolean;
    /** The brush these modes feel best with, as a fraction of the image's short side and a softness. */
    brush: { size: number; softness: number };
}

export const MODES: readonly ModeConfig[] = [
    { id: "remove", icon: WandSparkles, strength: false, texture: false, brush: { size: 0.05, softness: 0.2 } },
    { id: "heal", icon: Bandage, strength: false, texture: false, brush: { size: 0.025, softness: 0.35 } },
    { id: "smooth", icon: Droplets, strength: true, texture: true, brush: { size: 0.08, softness: 0.7 } },
    { id: "enhance", icon: Focus, strength: true, texture: false, brush: { size: 0.1, softness: 0.6 } },
    { id: "relight", icon: SunMedium, strength: true, texture: false, brush: { size: 0.14, softness: 0.8 } },
];

/** Selection tools. Retouch uses the brush, eraser and move; the watermark remover adds shapes. */
export type RetouchTool = "paint" | "erase" | "rect" | "lasso" | "move";
export const RETOUCH_TOOLS: readonly RetouchTool[] = ["paint", "erase", "move"];

export interface BrushOptions {
    /** Diameter in image pixels. */
    size: number;
    softness: number;
    opacity: number;
}

export const TOOL_ICONS: Record<RetouchTool, LucideIcon> = { paint: Brush, erase: Eraser, rect: SquareDashed, lasso: Lasso, move: Hand };
export const TOOL_KEYS: Record<RetouchTool, string> = { paint: "B", erase: "E", rect: "M", lasso: "L", move: "H" };

/** Short labels (buttons) and full ones (tooltips, screen readers). */
export const toolLabels = (t: Dictionary): Record<RetouchTool, { short: string; long: string }> => ({
    paint: { short: t.retouch.paint, long: t.retouch.paintTool },
    erase: { short: t.retouch.erase, long: t.retouch.eraseTool },
    rect: { short: t.retouch.rect, long: t.retouch.rectTool },
    lasso: { short: t.retouch.lasso, long: t.retouch.lassoTool },
    move: { short: t.retouch.move, long: t.retouch.moveTool },
});

export const modeConfig = (id: RetouchMode) => MODES.find((mode) => mode.id === id) ?? MODES[0]!;
