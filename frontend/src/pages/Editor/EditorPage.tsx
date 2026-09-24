import { PhotoEditor } from "@/features/editor/PhotoEditor";
import { ToolPage } from "@/features/image-processing/ToolPage";
import { useT } from "@/i18n";

export function EditorPage() {
    const t = useT();
    return (
        <ToolPage
            name={t.pages.editor.name}
            badge={t.toolPage.browserTool}
            hue="editor"
            guide={t.guides.editor}
            title={
                <>
                    {t.pages.editor.title} <span className="text-[var(--tool)]">{t.pages.editor.accent}</span>
                </>
            }
            description={t.pages.editor.description}
        >
            <PhotoEditor mode="edit" />
        </ToolPage>
    );
}
