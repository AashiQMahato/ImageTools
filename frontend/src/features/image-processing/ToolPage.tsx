import { Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useT } from "@/i18n";
import { Segmented } from "@/components/common/Segmented";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

const TOOLS = [
    { key: "removeBackground", href: ROUTES.removeBackground },
    { key: "upscale", href: ROUTES.upscale },
    { key: "crop", href: ROUTES.crop },
    { key: "editor", href: ROUTES.editor },
] as const;

interface ToolPageProps {
    /** Name used in the breadcrumb. */
    name: string;
    badge: string;
    title: ReactNode;
    description: string;
    /** Live chip shown opposite the breadcrumb (e.g. whether this server can run the tool). */
    status?: ReactNode;
    /**
     * The tool's identity colour. Sets `--tool` for everything inside, so the hero glow, badge,
     * title accent, primary button and focus ring all move together — one hue per tool, which
     * doubles as wayfinding when the image carries over between tools.
     */
    hue: "upscale" | "remove-background" | "crop" | "editor";
    children: ReactNode;
}

/**
 * Shared frame for every tool: breadcrumb, a centred header on a soft glow, the tool switcher,
 * then the workspace — plus page-wide drop / paste.
 */
export function ToolPage({ name, badge, title, description, status, hue, children }: ToolPageProps) {
    const t = useT();
    return (
        <div data-tool={hue}>
            <section className="hero-glow -mt-18 pt-18">
                <div className="page-container pt-2 pb-9 md:pt-4 md:pb-11">
                    {status && <div className="animate-enter flex justify-end [--i:0]">{status}</div>}

                    <header className="flex flex-col items-center text-center">
                        <p className="animate-enter section-badge gap-1.5 [--i:1]">
                            <Sparkles className="size-3.5" aria-hidden />
                            {badge}
                        </p>
                        <h1 className="animate-enter mt-5 text-chapter text-balance text-primary [--i:2]">{title}</h1>
                        <p className="animate-enter mt-4 max-w-2xl text-lead text-pretty text-tertiary [--i:3]">{description}</p>
                        <div className="animate-enter mt-7 max-w-full [--i:4]">
                            <ToolSwitcher />
                        </div>
                    </header>
                </div>
            </section>

            <section aria-label={t.toolPage.workspace(name)} className="page-container pb-20 md:pb-24">
                <div className="animate-enter [--i:5]">{children}</div>
            </section>

            <PageDropTarget />
        </div>
    );
}

/** The image carries over when switching tools, so you can remove a background, then upscale the same photo. */
function ToolSwitcher() {
    const t = useT();
    const { pathname } = useLocation();
    return (
        <Segmented
            kind="nav"
            label={t.nav.tools}
            scrollable
            value={TOOLS.find((tool) => pathname.startsWith(tool.href))?.href ?? ""}
            options={TOOLS.map((tool) => ({ value: tool.href, href: tool.href, label: t.toolPage.switcher[tool.key] }))}
        />
    );
}

/** Drop an image anywhere on the page, or paste one (⌘/Ctrl + V). */
function PageDropTarget() {
    const t = useT();
    const { acceptFile, error, clearError } = useImageUpload({ navigateTo: null });
    const [dragging, setDragging] = useState(false);

    useEffect(() => {
        let depth = 0;
        const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
        const onEnter = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            depth++;
            setDragging(true);
        };
        const onLeave = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) setDragging(false);
        };
        const onOver = (event: DragEvent) => {
            if (hasFiles(event)) event.preventDefault();
        };
        const onDrop = (event: DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            depth = 0;
            setDragging(false);
            const file = event.dataTransfer?.files[0];
            if (file) void acceptFile(file);
        };
        const onPaste = (event: ClipboardEvent) => {
            const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
            if (file) {
                event.preventDefault();
                void acceptFile(file);
            }
        };
        window.addEventListener("dragenter", onEnter);
        window.addEventListener("dragleave", onLeave);
        window.addEventListener("dragover", onOver);
        window.addEventListener("drop", onDrop);
        window.addEventListener("paste", onPaste);
        return () => {
            window.removeEventListener("dragenter", onEnter);
            window.removeEventListener("dragleave", onLeave);
            window.removeEventListener("dragover", onOver);
            window.removeEventListener("drop", onDrop);
            window.removeEventListener("paste", onPaste);
        };
    }, [acceptFile]);

    useEffect(() => {
        if (!error) return;
        const timeout = window.setTimeout(clearError, 5000);
        return () => window.clearTimeout(timeout);
    }, [error, clearError]);

    return (
        <>
            <div
                aria-hidden={!dragging}
                className={cn(
                    "pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-6 transition-opacity duration-300",
                    dragging ? "opacity-100" : "opacity-0",
                )}
            >
                <div className="absolute inset-0 bg-primary/70 backdrop-blur-md" />
                <div className="relative flex size-full items-center justify-center rounded-[2rem] border-2 border-dashed border-[var(--color-focus-ring)]">
                    <p className="text-tile text-primary">{t.upload.dropToOpen}</p>
                </div>
            </div>
            <div
                role="alert"
                className={cn(
                    "material fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-medium text-error-primary transition-[opacity,translate] duration-300",
                    error ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
                )}
            >
                {error}
            </div>
        </>
    );
}
