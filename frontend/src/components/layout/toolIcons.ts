import { Combine, Crop, Eraser, FileImage, Images, LayoutGrid, RotateCwSquare, Split, IdCard, type LucideIcon, RotateCw, Scaling, ScanText, Shrink, SlidersHorizontal, Stamp, WandSparkles, ZoomIn } from "lucide-react";
import type { ToolKey } from "@/lib/constants/navigation";

/** The same mark for a tool everywhere it appears — these match the hero chips and the tool pages. */
export const TOOL_ICONS: Record<ToolKey, LucideIcon> = {
    removeBackground: Eraser,
    upscaler: ZoomIn,
    retouch: WandSparkles,
    photoGenerator: IdCard,
    watermarkRemover: Stamp,
    compressor: Shrink,
    crop: Crop,
    resize: Scaling,
    rotateFlip: RotateCw,
    editor: SlidersHorizontal,
    ocr: ScanText,
    pdfMerge: Combine,
    pdfSplit: Split,
    pdfOrganize: LayoutGrid,
    pdfRotate: RotateCwSquare,
    pdfToImages: FileImage,
    imagesToPdf: Images,
};
