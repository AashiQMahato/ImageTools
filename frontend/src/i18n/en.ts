/**
 * English strings — the source of truth for every key. Other languages must provide the same shape
 * (enforced by the `Dictionary` type), so a missing translation is a type error.
 */

export interface ToolGuide {
    howTo: string[];
    bestFor: string[];
    tips: string[];
    faqs: Array<{ q: string; a: string }>;
}

const num = (value: number) => value.toLocaleString("en-US");

export const en = {
    meta: { lang: "en", name: "English", short: "EN" },

    common: {
        appName: "Image Tools",
        homeAria: "Image Tools home",
        upload: "Upload",
        uploadImage: "Upload image",
        uploadHint: "JPG, PNG or WebP · up to 10 MB",
        download: "Download",
        original: "Original",
        before: "Before",
        after: "After",
        cancel: "Cancel",
        tryAgain: "Try again",
        startOver: "Start over",
        replace: "Replace",
        chooseImage: "Choose image",
        chooseAnother: "Choose another image",
        openAnother: "Open another image",
        closeImage: "Close image",
        openTool: "Open tool",
        language: "Language",
        switchToLight: "Switch to light mode",
        switchToDark: "Switch to dark mode",
        openMenu: "Open menu",
        closeMenu: "Close menu",
        skipToContent: "Skip to content",
        dimensions: (w: number, h: number) => `${num(w)} × ${num(h)}`,
    },

    nav: {
        tools: "Tools",
        removeBgShort: "Remove BG",
        removeBg: "Remove Background",
        upscale: "Upscale",
        upscaler: "Upscaler",
        crop: "Crop",
        editor: "Editor",
    },

    footer: {
        tagline: "Simple, focused tools for better images.",
        blurb: "Remove backgrounds, upscale with AI, crop and edit — with nothing to install and nothing stored.",
        product: "Product",
        resources: "Resources",
        company: "Company",
        faq: "FAQ",
        about: "About",
        privacy: "Privacy",
        terms: "Terms",
        rights: (year: number) => `© ${year} Image Tools. All rights reserved.`,
        privacyNote: "Images are processed privately and never stored.",
    },

    upload: {
        wrongType: "Please choose a JPG, PNG or WebP image.",
        tooLarge: "That image is larger than 10 MB. Please choose a smaller one.",
        unreadable: "This file couldn't be read as an image. It may be damaged.",
        dropHere: "Drop an image here",
        chooseOnTouch: "Choose an image",
        orChoose: "or",
        chooseAFile: "choose a file",
        canPaste: "you can also paste",
        fromPhotos: "from your photos or files",
        dropToOpen: "Drop to open",
    },

    hero: {
        badge: "Image tools",
        title: "Your images, at their best.",
        description: "Clean up backgrounds, restore detail with AI upscaling, and crop, adjust and resize your photos — in a few clicks, no design skills required.",
        tryDemo: "Try the demo",
        points: ["Remove backgrounds", "Upscale 2× or 4×", "Crop, adjust and resize"],
    },

    heroDemo: {
        alt: "A common kingfisher perched on a mossy branch against a soft, blurred background",
        removeBackground: "Remove background",
        removing: "Removing background…",
        holdToCompare: "Hold to compare",
        done: "Background removed. The result is ready to download.",
        hoverHint: "Hover to preview.",
        caption: "A live demo on a sample photo.",
    },

    showcase: {
        badge: "Before / After",
        title: "See the tools in action",
        description: "Real results from the tools on sample photos. Drag the divider to compare the upload with the result.",
        tryIt: "Try it on your image",
        dragToCompare: "Drag to compare",
        region: "Before and after examples",
        choose: "Choose example",
        prev: "Prev",
        next: "Next",
        prevAria: "Previous example",
        nextAria: "Next example",
        upscaled: "Upscaled",
        slides: {
            heron: {
                title: "Heron on stone — subject isolated",
                before: "A striated heron standing on a weathered stone ledge",
                after: "The heron cut out on a transparent background",
            },
            goose: {
                title: "Goose portrait — detail restored",
                before: "A low-resolution close-up of a goose's eye",
                after: "The same close-up at full resolution",
                note: "Illustrative: the original is the photo at one-sixth resolution.",
            },
            kingfisher: {
                title: "Kingfisher on a branch — clean cut-out",
                before: "A common kingfisher perched on a mossy branch",
                after: "The kingfisher cut out on a transparent background",
            },
        },
    },

    toolsSection: {
        badge: "The toolkit",
        title: "Everything your images need",
        description: "Four focused tools that work together. Open an image once and carry it from one tool to the next.",
        items: {
            removeBackground: {
                title: "Remove background",
                description: "Separate the subject in one step and get a transparent PNG — fine edges like hair and feathers included.",
            },
            upscale: {
                title: "AI upscaling",
                description: "Enlarge small or low-resolution images 2× or 4× so they hold up on large screens, product pages and print.",
            },
            crop: {
                title: "Crop & straighten",
                description: "Drag to frame, straighten the horizon, pick a ratio, rotate or flip — with a precise, fluid crop tool.",
            },
            editor: {
                title: "Adjust & resize",
                description: "Fine-tune light and colour, try a look, resize to exact pixels and export as JPG, PNG or WebP.",
            },
        },
    },

    workflow: {
        badge: "Workflow",
        title: "Better images in three simple steps",
        description: "Each step is designed for speed and clarity — from your original to the finished file.",
        getStarted: "Get started",
        steps: [
            { title: "Upload your image", description: "Drop, paste or choose a JPG, PNG or WebP up to 10 MB. It opens instantly — no account needed." },
            { title: "Pick a tool", description: "Remove the background, upscale, crop or adjust. See the result right away and compare it with the original." },
            { title: "Download", description: "Save the result at full quality — a transparent PNG, a sharper upscale or your edited photo." },
        ],
        dropHere: "Drop an image here",
        formats: "JPG, PNG or WebP",
        backgroundRemoved: "Background removed",
    },

    editorSection: {
        badge: "Crop & edit",
        title: "Frame it just right.",
        description: "A fluid crop tool and a focused editor that run right in your browser — your photo never leaves your device.",
        features: ["Any aspect ratio", "Precise straighten dial", "Rotate & flip", "Light & colour", "Filters & looks", "Exact resize"],
        openCropper: "Open the cropper",
        openEditor: "Open the editor",
    },

    miniEditor: {
        alt: "A flamingo curving its neck against dark green foliage",
        cropArea: "Crop area. Drag, or use the arrow keys, to move it.",
        aspect: "Aspect ratio",
        outputSize: "Output size",
        rotate: "Rotate 90°",
        flip: "Flip horizontally",
    },

    why: {
        badge: "Why Image Tools?",
        title: "Professional results, without the complexity",
        description: "Powerful image editing that gets out of your way.",
        items: [
            { title: "Seconds, not hours", description: "Skip manual masking and fiddly desktop software. Most images are ready in seconds, right in your browser." },
            { title: "Private by design", description: "Images sent for AI processing are returned to you and never stored. Cropping and editing happen entirely on your device." },
            { title: "Full-quality results", description: "Download at full resolution — transparent PNGs, sharper upscales, and edits exported as JPG, PNG or WebP." },
        ],
    },

    faq: {
        badge: "Quick answers",
        title: "Answers to the questions people ask most",
        description: "Clear, short answers so you can get back to your images.",
        items: [
            { q: "Which image formats can I use?", a: "JPG, PNG and WebP, up to 10 MB each. Files are checked when you choose them, so you'll know straight away if something can't be opened." },
            { q: "Are my images stored?", a: "No. Background removal and upscaling run on our server and the result is sent straight back — nothing is kept. Cropping and editing happen entirely in your browser." },
            { q: "How does AI upscaling work?", a: "It uses an open-source Real-ESRGAN model (via Upscayl) to enlarge your image 2× or 4×, predicting fine detail rather than simply stretching pixels." },
            { q: "Do I need an account?", a: "No. Open the site, choose an image and start — there's no sign-up." },
            { q: "What do I get when I download?", a: "Background removal gives a transparent PNG at the original size. Upscales keep your format. The editor exports JPG, PNG or WebP at the size you choose." },
            { q: "Does it work on my phone?", a: "Yes. Every tool works in mobile browsers, including touch gestures like pinch-to-zoom in the cropper." },
        ],
    },

    cta: {
        badge: "Get started",
        title: "Ready when your image is.",
        description: "Upload a photo and try every tool — no sign-up, nothing stored.",
    },

    toolPage: {
        home: "Home",
        breadcrumb: "Breadcrumb",
        workspace: (name: string) => `${name} workspace`,
        switcher: { removeBackground: "Remove background", upscale: "Upscale", crop: "Crop", editor: "Edit" },
        guideBadge: "Guide",
        guideTitle: "How to get great results",
        howTo: "How to use",
        bestFor: "Best for",
        tips: "Tips",
        questionsBadge: "Questions",
        goodToKnow: "Good to know",
        moreAnswers: "More answers in the",
        mainFaq: "main FAQ",
        aiTool: "AI tool",
        browserTool: "In-browser tool",
    },

    pages: {
        removeBackground: {
            name: "Remove background",
            title: "Remove background.",
            accent: "Keep the subject.",
            description: "Upload a photo and get a clean, transparent PNG of the subject.",
            action: "Remove background",
        },
        upscale: {
            name: "Upscale",
            title: "Upscale.",
            accent: "Bring back the detail.",
            description: "Enlarge an image 2× or 4× with AI, then compare it with the original up close.",
            action: (scale: number) => `Upscale ${scale}×`,
            factor: "Upscale factor",
            tooLargeFor: "Too large to upscale this much",
            unavailable: "Upscaling is unavailable on this server.",
        },
        crop: {
            name: "Crop",
            title: "Crop.",
            accent: "Frame it just right.",
            description: "Drag the corners, move the photo, straighten the horizon. Everything happens on your device.",
        },
        editor: {
            name: "Editor",
            title: "Edit.",
            accent: "Make it yours.",
            description: "Adjust light and colour, try a look, crop and resize — then export in the format you need.",
        },
    },

    guides: {
        removeBackground: {
            howTo: [
                "Drop, paste or choose a JPG, PNG or WebP image (up to 10 MB).",
                "Select “Remove background”.",
                "Drag the divider to compare the original with the cut-out.",
                "Download a transparent PNG at the original size.",
            ],
            bestFor: ["Product photos for online stores", "Profile pictures and portraits", "Stickers, logos and graphics", "Placing a subject on a new background"],
            tips: [
                "Clear contrast between subject and background gives the cleanest edges.",
                "Fine detail such as hair and feathers is kept as soft, semi-transparent edges.",
                "Open the result in the editor to crop or resize it before you share it.",
            ],
            faqs: [
                { q: "What format is the result?", a: "A PNG with a transparent background, at the same width and height as your upload." },
                { q: "Is my image stored?", a: "No. It is processed on our server and the result is sent straight back — nothing is kept." },
                { q: "Does it work with multiple subjects?", a: "Yes. Everything the model recognises as foreground is kept together." },
            ],
        },
        upscale: {
            howTo: [
                "Drop, paste or choose a JPG, PNG or WebP image.",
                "Pick 2× or 4× enlargement.",
                "Select “Upscale” and compare the result up close with Fit, 2× and 4× zoom.",
                "Download the enlarged image in the same format you uploaded.",
            ],
            bestFor: ["Small or low-resolution photos", "Images for large screens and print", "Old or compressed pictures", "Product images that need more detail"],
            tips: [
                "Start with 2× — it is faster, and 4× is limited to smaller inputs.",
                "Upscaling predicts detail; it can't recover text or faces that aren't in the original.",
                "Transparent PNGs keep their transparency when upscaled.",
            ],
            faqs: [
                { q: "How large can the result be?", a: "Up to about 40 megapixels. Larger inputs can still be upscaled 2× even when 4× is too big." },
                { q: "Which model is used?", a: "An open-source Real-ESRGAN model running through Upscayl on our server." },
                { q: "Why does it take a few seconds?", a: "The AI model runs on every tile of your image. Larger images and 4× take longer." },
            ],
        },
        crop: {
            howTo: [
                "Drop, paste or choose an image — it opens in your browser.",
                "Drag the corners to frame it, or drag the photo to reposition it.",
                "Straighten with the dial, pick an aspect ratio, rotate or flip.",
                "Export as JPG, PNG or WebP.",
            ],
            bestFor: ["Social posts in square, portrait or 16:9", "Straightening tilted horizons", "Removing distractions at the edges", "Preparing images for exact layouts"],
            tips: ["Double-click the straighten dial to return to level.", "Pinch or ctrl + scroll to zoom into the photo.", "Undo and redo with ⌘Z and ⇧⌘Z."],
            faqs: [
                { q: "Is my image uploaded?", a: "No. Cropping runs entirely in your browser." },
                { q: "Does cropping reduce quality?", a: "No. The export is rendered from your original at full resolution." },
                { q: "Can I keep editing after cropping?", a: "Yes. Switch to Edit — your crop carries over." },
            ],
        },
        editor: {
            howTo: [
                "Drop, paste or choose an image — it opens in your browser.",
                "Adjust exposure, contrast, colour and more, or try a filter.",
                "Crop and resize to the exact size you need.",
                "Hold Compare to check against the original, then export.",
            ],
            bestFor: ["Quick light and colour fixes", "Consistent looks across a set of photos", "Resizing for web, email or marketplaces", "Converting between JPG, PNG and WebP"],
            tips: ["Hold M (or the Compare button) to see the original.", "Double-click any slider to reset it.", "Need it bigger than the original? Use the AI upscaler."],
            faqs: [
                { q: "Is my image uploaded?", a: "No. Every edit runs in your browser and nothing leaves your device." },
                { q: "Does the export match the preview?", a: "Yes. The same colour processing drives both, rendered at full resolution." },
                { q: "Are my edits saved?", a: "They last while the page is open, with full undo and redo. Export to keep the result." },
            ],
        },
    } satisfies Record<string, ToolGuide>,

    workspace: {
        noImage: "No image selected",
        hintIdle: "Your image stays private and is never stored.",
        hintSelected: "Ready when you are.",
        hintProcessing: "This usually takes a few seconds.",
        hintSuccess: (before: string, after: string) => `Drag the divider to compare ${before.toLowerCase()} and ${after.toLowerCase()}.`,
        uploading: (percent: number) => `Uploading… ${percent}%`,
        processing: "Processing your image…",
        unavailableTitle: "Not available right now",
        selectedAlt: (name: string) => `Selected image: ${name}`,
        zoom: "Zoom",
        fit: "Fit",
        fitAria: "Fit to view",
        zoomAria: (level: number) => `Zoom ${level}×`,
        backgroundRemoved: "Background removed",
        upscaled: "Upscaled",
    },

    compare: {
        slider: (before: string, after: string) => `Compare ${before.toLowerCase()} and ${after.toLowerCase()}`,
        value: (percent: number, before: string) => `${percent}% ${before.toLowerCase()}`,
    },

    /** Messages for API error codes, so server errors appear in the chosen language. */
    errors: {
        FILE_REQUIRED: "Please choose an image to upload.",
        FILE_TOO_LARGE: "The image is too large. Please upload an image under 10 MB.",
        UNSUPPORTED_MEDIA_TYPE: "Unsupported file type. Please upload a JPG, PNG or WebP image.",
        INVALID_IMAGE: "This file couldn't be read as an image. It may be damaged.",
        IMAGE_TOO_LARGE: "This image is too large to process at this size. Try 2× or a smaller image.",
        INVALID_SCALE: "Scale must be 2 or 4.",
        SERVER_BUSY: "The server is busy processing other images. Please try again in a moment.",
        PROCESSING_TIMEOUT: "Processing took too long. Please try a smaller image.",
        PROCESSING_FAILED: "Processing failed. Please try again.",
        BACKGROUND_REMOVAL_UNAVAILABLE: "Background removal is temporarily unavailable. Please try again.",
        UPSCALING_UNAVAILABLE: "Upscaling is unavailable on this server.",
        RATE_LIMITED: "You've processed a lot of images in a short time. Please wait a few minutes and try again.",
        NETWORK: "Couldn't reach the server. Check your connection and try again.",
        GENERIC: "Something went wrong. Please try again.",
    } as Record<string, string>,

    editor: {
        tabs: { adjust: "Adjust", filters: "Filters", crop: "Crop", resize: "Resize" },
        editTools: "Edit tools",
        undo: "Undo (⌘Z)",
        redo: "Redo (⇧⌘Z)",
        revert: "Revert",
        revertAria: "Revert to original",
        compare: "Compare",
        compareAria: "Hold to compare with the original (or hold M)",
        showingOriginal: "Original",
        export: "Export",
        opening: "Opening image…",
        openFailed: "This image couldn't be opened. Please try another one.",
        localNote: "Edits happen on your device — nothing is uploaded.",
        editingAlt: (name: string) => `Editing ${name}`,
        cropStage: "Crop. Drag to move the photo, drag the corners to resize, pinch to zoom. Arrow keys move, plus and minus zoom.",
        cropRole: "crop area",
        adjust: {
            light: "Light",
            colour: "Colour",
            exposure: "Exposure",
            brightness: "Brightness",
            contrast: "Contrast",
            saturation: "Saturation",
            warmth: "Warmth",
            tint: "Tint",
            reset: "Reset adjustments",
            resetOne: (label: string) => `Reset ${label}`,
        },
        filters: {
            label: "Filter",
            original: "Original",
            vivid: "Vivid",
            warm: "Vivid Warm",
            cool: "Vivid Cool",
            dramatic: "Dramatic",
            mono: "Mono",
            silvertone: "Silvertone",
            noir: "Noir",
        },
        crop: {
            aspect: "Aspect ratio",
            freeform: "Freeform",
            original: "Original",
            square: "Square",
            landscape: "Use landscape ratio",
            portrait: "Use portrait ratio",
            rotateLeft: "Rotate left 90°",
            flipH: "Flip horizontal",
            flipV: "Flip vertical",
            straighten: "Straighten",
            level: "Straighten: level",
            degrees: (d: number) => `${d} degrees`,
            resetLevel: (d: number) => `Straighten: ${d} degrees. Reset to level`,
        },
        resize: {
            width: "Width",
            height: "Height",
            widthAria: "Width in pixels",
            heightAria: "Height in pixels",
            lock: "Lock aspect ratio",
            unlock: "Unlock aspect ratio",
            scale: "Scale",
            longEdge: "Long edge",
            alreadySmaller: "Already smaller than the presets.",
            output: "Output",
            megapixels: (mp: string) => `${mp} megapixels`,
            bigger: "Need it bigger? Upscale with AI",
        },
        exportMenu: {
            title: "Export",
            format: "Format",
            notes: { jpeg: "Smallest files", png: "Lossless, keeps transparency", webp: "Small, keeps transparency" },
            quality: "Quality",
            preparing: "Preparing",
            tooLarge: "That's too large to export. Try a smaller size.",
            failed: "Export failed. Please try again.",
        },
    },
};

export type Dictionary = typeof en;
