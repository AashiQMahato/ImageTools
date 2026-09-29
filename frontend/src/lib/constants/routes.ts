export const ROUTES = {
    home: "/",
    removeBackground: "/remove-background",
    upscale: "/upscale",
    crop: "/crop",
    editor: "/editor",
    retouch: "/retouch",
    photoGenerator: "/photo-generator",
    compress: "/compress",
    watermarkRemover: "/watermark-remover",
    ocr: "/ocr",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
