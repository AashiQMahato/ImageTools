import { lazy, type ReactNode, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ROUTES } from "@/lib/constants/routes";
import { CropperPage } from "@/pages/Cropper/CropperPage";
import { EditorPage } from "@/pages/Editor/EditorPage";
import { HomePage } from "@/pages/Home/HomePage";
import { RemoveBackgroundPage } from "@/pages/RemoveBackground/RemoveBackgroundPage";
import { CompressorPage } from "@/pages/Compressor/CompressorPage";
import { PhotoGeneratorPage } from "@/pages/PhotoGenerator/PhotoGeneratorPage";
import { RetouchPage } from "@/pages/Retouch/RetouchPage";
import { UpscalerPage } from "@/pages/Upscaler/UpscalerPage";
import { WatermarkRemoverPage } from "@/pages/WatermarkRemover/WatermarkRemoverPage";

// The OCR editor brings a rich-text editor with it; only its own page loads that.
const OcrPage = lazy(() => import("@/pages/Ocr/OcrPage").then((module) => ({ default: module.OcrPage })));
// The document tools share pdf.js previews and their own components: loaded when one opens.
const DocumentsPage = lazy(() => import("@/pages/Documents/DocumentsPage").then((module) => ({ default: module.DocumentsPage })));
const MergePage = lazy(() => import("@/pages/Pdf/MergePage").then((module) => ({ default: module.MergePage })));
const SplitPage = lazy(() => import("@/pages/Pdf/SplitPage").then((module) => ({ default: module.SplitPage })));
const OrganizePage = lazy(() => import("@/pages/Pdf/OrganizePage").then((module) => ({ default: module.OrganizePage })));
const RotatePage = lazy(() => import("@/pages/Pdf/OrganizePage").then((module) => ({ default: module.RotatePage })));
const ToImagesPage = lazy(() => import("@/pages/Pdf/ToImagesPage").then((module) => ({ default: module.ToImagesPage })));
const ImagesToPdfPage = lazy(() => import("@/pages/Pdf/ImagesToPdfPage").then((module) => ({ default: module.ImagesToPdfPage })));

const later = (page: ReactNode) => <Suspense fallback={null}>{page}</Suspense>;

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path={ROUTES.home} element={<HomePage />} />
                <Route path={ROUTES.removeBackground} element={<RemoveBackgroundPage />} />
                <Route path={ROUTES.upscale} element={<UpscalerPage />} />
                <Route path={ROUTES.retouch} element={<RetouchPage />} />
                <Route path={ROUTES.photoGenerator} element={<PhotoGeneratorPage />} />
                <Route path={ROUTES.watermarkRemover} element={<WatermarkRemoverPage />} />
                <Route path={ROUTES.ocr} element={later(<OcrPage />)} />
                <Route path={ROUTES.documents} element={later(<DocumentsPage />)} />
                <Route path={ROUTES.pdfMerge} element={later(<MergePage />)} />
                <Route path={ROUTES.pdfSplit} element={later(<SplitPage />)} />
                <Route path={ROUTES.pdfOrganize} element={later(<OrganizePage />)} />
                <Route path={ROUTES.pdfRotate} element={later(<RotatePage />)} />
                <Route path={ROUTES.pdfToImages} element={later(<ToImagesPage />)} />
                <Route path={ROUTES.imagesToPdf} element={later(<ImagesToPdfPage />)} />
                <Route path={ROUTES.compress} element={<CompressorPage />} />
                <Route path={ROUTES.crop} element={<CropperPage />} />
                <Route path={ROUTES.editor} element={<EditorPage />} />
                <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
            </Route>
        </Routes>
    );
}
