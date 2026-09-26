import { Crop, Eraser, type LucideIcon, RotateCw, Scaling, SlidersHorizontal, WandSparkles, ZoomIn } from "lucide-react";
import type { ToolKey } from "@/lib/constants/navigation";

/** The same mark for a tool everywhere it appears — these match the hero chips and the tool pages. */
export const TOOL_ICONS: Record<ToolKey, LucideIcon> = {
    removeBackground: Eraser,
    upscaler: ZoomIn,
    retouch: WandSparkles,
    crop: Crop,
    resize: Scaling,
    rotateFlip: RotateCw,
    editor: SlidersHorizontal,
};
