import { Eraser } from "lucide-react";
import { PagePlaceholder } from "@/components/common/PagePlaceholder";

export function RemoveBackgroundPage() {
    return <PagePlaceholder title="Remove Background" description="AI background removal will live here. Upload an image and get a clean, transparent cutout." icon={Eraser} />;
}
