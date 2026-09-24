import type { LucideIcon } from "lucide-react";
import { Crop, Eraser, SlidersHorizontal, ZoomIn } from "lucide-react";
import { type AppRoute, ROUTES } from "./routes";

export interface ToolDefinition {
    id: string;
    name: string;
    description: string;
    href: AppRoute;
    icon: LucideIcon;
    isAi: boolean;
}

export const TOOLS: readonly ToolDefinition[] = [
    {
        id: "remove-background",
        name: "Remove Background",
        description: "Isolate the subject of any photo with a clean, transparent cutout.",
        href: ROUTES.removeBackground,
        icon: Eraser,
        isAi: true,
    },
    {
        id: "upscale",
        name: "Upscaler",
        description: "Increase resolution while keeping edges sharp and details intact.",
        href: ROUTES.upscale,
        icon: ZoomIn,
        isAi: true,
    },
    {
        id: "crop",
        name: "Cropper",
        description: "Crop to any aspect ratio with precise, pixel-level control.",
        href: ROUTES.crop,
        icon: Crop,
        isAi: false,
    },
    {
        id: "editor",
        name: "Editor",
        description: "Resize, rotate and flip images, then compare before and after.",
        href: ROUTES.editor,
        icon: SlidersHorizontal,
        isAi: false,
    },
];
