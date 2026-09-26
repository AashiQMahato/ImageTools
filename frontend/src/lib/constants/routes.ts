export const ROUTES = {
    home: "/",
    removeBackground: "/remove-background",
    upscale: "/upscale",
    crop: "/crop",
    editor: "/editor",
    retouch: "/retouch",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
