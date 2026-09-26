import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ROUTES } from "@/lib/constants/routes";
import { CropperPage } from "@/pages/Cropper/CropperPage";
import { EditorPage } from "@/pages/Editor/EditorPage";
import { HomePage } from "@/pages/Home/HomePage";
import { RemoveBackgroundPage } from "@/pages/RemoveBackground/RemoveBackgroundPage";
import { PhotoGeneratorPage } from "@/pages/PhotoGenerator/PhotoGeneratorPage";
import { RetouchPage } from "@/pages/Retouch/RetouchPage";
import { UpscalerPage } from "@/pages/Upscaler/UpscalerPage";

export function AppRoutes() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route path={ROUTES.home} element={<HomePage />} />
                <Route path={ROUTES.removeBackground} element={<RemoveBackgroundPage />} />
                <Route path={ROUTES.upscale} element={<UpscalerPage />} />
                <Route path={ROUTES.retouch} element={<RetouchPage />} />
                <Route path={ROUTES.photoGenerator} element={<PhotoGeneratorPage />} />
                <Route path={ROUTES.crop} element={<CropperPage />} />
                <Route path={ROUTES.editor} element={<EditorPage />} />
                <Route path="*" element={<Navigate to={ROUTES.home} replace />} />
            </Route>
        </Routes>
    );
}
