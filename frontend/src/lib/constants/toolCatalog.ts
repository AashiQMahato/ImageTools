import { type AppRoute, ROUTES } from "./routes";
import type { ToolKey } from "./navigation";

export type ToolCategory = "pdf" | "text" | "convert" | "organize" | "image" | "ai";

export interface CatalogTool {
    key: ToolKey;
    href: AppRoute;
    /** Where the tool belongs; the first is its home. */
    categories: readonly ToolCategory[];
    /** Extra words people search with (English; each language's names and descriptions match too). */
    keywords: readonly string[];
}

/**
 * Every tool, once — for the Documents page and tool search. Only tools that exist are listed; a new
 * tool is one entry here (plus its route, icon and copy).
 */
export const TOOL_CATALOG: readonly CatalogTool[] = [
    { key: "pdfMerge", href: ROUTES.pdfMerge, categories: ["pdf", "organize"], keywords: ["combine", "join", "append", "pdf"] },
    { key: "pdfSplit", href: ROUTES.pdfSplit, categories: ["pdf", "organize"], keywords: ["separate", "extract", "divide", "ranges", "pdf"] },
    { key: "pdfOrganize", href: ROUTES.pdfOrganize, categories: ["pdf", "organize"], keywords: ["reorder", "sort", "delete pages", "remove pages", "duplicate", "extract", "arrange", "pdf"] },
    { key: "pdfRotate", href: ROUTES.pdfRotate, categories: ["pdf", "organize"], keywords: ["turn", "orientation", "sideways", "upside down", "pdf"] },
    { key: "pdfToImages", href: ROUTES.pdfToImages, categories: ["pdf", "convert"], keywords: ["convert", "export", "jpg", "jpeg", "png", "webp", "pdf to jpg", "pdf to png", "pdf to image"] },
    { key: "imagesToPdf", href: ROUTES.imagesToPdf, categories: ["pdf", "convert"], keywords: ["convert", "create pdf", "jpg to pdf", "png to pdf", "photo to pdf", "scan", "heic"] },
    { key: "ocr", href: ROUTES.ocr, categories: ["text", "convert"], keywords: ["ocr", "extract text", "convert", "image to text", "pdf to text", "scan", "nepali", "devanagari", "editable"] },
    { key: "compressor", href: ROUTES.compress, categories: ["image"], keywords: ["compress", "reduce", "smaller", "size", "optimize", "shrink"] },
    { key: "removeBackground", href: ROUTES.removeBackground, categories: ["ai", "image"], keywords: ["background", "transparent", "cutout", "remove bg"] },
    { key: "upscaler", href: ROUTES.upscale, categories: ["ai", "image"], keywords: ["enlarge", "upscale", "resolution", "sharpen", "bigger"] },
    { key: "retouch", href: ROUTES.retouch, categories: ["ai", "image"], keywords: ["remove object", "repair", "fix", "clean up", "blemish"] },
    { key: "photoGenerator", href: ROUTES.photoGenerator, categories: ["ai", "image"], keywords: ["passport", "mrp", "id photo", "visa"] },
    { key: "watermarkRemover", href: ROUTES.watermarkRemover, categories: ["ai", "image"], keywords: ["watermark", "logo", "remove text"] },
    { key: "crop", href: ROUTES.crop, categories: ["image"], keywords: ["crop", "rotate", "flip", "straighten", "aspect ratio"] },
    { key: "editor", href: ROUTES.editor, categories: ["image"], keywords: ["adjust", "resize", "filters", "brightness", "colour", "color", "convert", "export"] },
];

export const DOCUMENT_CATEGORIES: readonly ToolCategory[] = ["pdf", "text", "convert", "organize"];
export const isDocumentTool = (tool: CatalogTool) => tool.categories.some((category) => category === "pdf" || category === "text");

const normalise = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Tools matching a search, best first: every word must match the name, description or keywords;
 * matches in the name rank first.
 */
export function searchTools(query: string, tools: readonly CatalogTool[], text: (tool: CatalogTool) => { title: string; description: string }) {
    const words = normalise(query).split(/\s+/).filter(Boolean);
    if (!words.length) return [...tools];
    return tools
        .map((tool) => {
            const { title, description } = text(tool);
            const name = normalise(title);
            const rest = normalise([description, ...tool.keywords].join(" "));
            if (!words.every((word) => name.includes(word) || rest.includes(word))) return null;
            const score = words.reduce((sum, word) => sum + (name.startsWith(word) ? 3 : name.includes(word) ? 2 : 1), 0);
            return { tool, score };
        })
        .filter((match): match is { tool: CatalogTool; score: number } => match !== null)
        .sort((a, b) => b.score - a.score)
        .map((match) => match.tool);
}
