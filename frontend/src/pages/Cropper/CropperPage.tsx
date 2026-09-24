import { PhotoEditor } from "@/features/editor/PhotoEditor";
import { ToolPage } from "@/features/image-processing/ToolPage";
import { useT } from "@/i18n";

export function CropperPage() {
    const t = useT();
    return (
        <ToolPage
            name={t.pages.crop.name}
            badge={t.toolPage.browserTool}
            hue="crop"
            guide={t.guides.crop}
            title={
                <>
                    {t.pages.crop.title} <span className="text-[var(--tool)]">{t.pages.crop.accent}</span>
                </>
            }
            description={t.pages.crop.description}
        >
            <PhotoEditor mode="crop" />
        </ToolPage>
    );
}
