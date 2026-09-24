import { type AppRoute, ROUTES } from "./routes";

export interface NavItem {
    label: string;
    fullLabel: string;
    href: AppRoute;
}

export const PRIMARY_NAV: readonly NavItem[] = [
    { label: "Remove BG", fullLabel: "Remove Background", href: ROUTES.removeBackground },
    { label: "Upscale", fullLabel: "Upscaler", href: ROUTES.upscale },
    { label: "Crop", fullLabel: "Crop", href: ROUTES.crop },
    { label: "Editor", fullLabel: "Editor", href: ROUTES.editor },
];
