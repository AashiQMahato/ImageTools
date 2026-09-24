import { type ReactNode, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

const TOOLS = [
    { label: "Remove background", href: ROUTES.removeBackground },
    { label: "Upscale", href: ROUTES.upscale },
] as const;

interface ToolPageProps {
    title: ReactNode;
    description: string;
    children: ReactNode;
}

/** Shared frame for the processing tools: heading, tool switcher, and page-wide drop / paste support. */
export function ToolPage({ title, description, children }: ToolPageProps) {
    return (
        <section className="page-container pt-8 pb-16 md:pt-14 md:pb-24">
            <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-chapter text-balance text-primary">{title}</h1>
                    <p className="mt-3 max-w-xl text-lg text-pretty text-tertiary">{description}</p>
                </div>
                <ToolSwitcher />
            </header>
            <div className="mt-8 md:mt-10">{children}</div>
            <PageDropTarget />
        </section>
    );
}

/** The image carries over when switching tools, so you can remove a background, then upscale the same photo. */
function ToolSwitcher() {
    return (
        <nav aria-label="Tools" className="flex shrink-0 self-start rounded-full bg-secondary p-1 md:self-auto">
            {TOOLS.map((tool) => (
                <NavLink
                    key={tool.href}
                    to={tool.href}
                    className={({ isActive }) =>
                        cn(
                            "rounded-full px-4 py-2 text-sm font-medium transition-[color,background-color,box-shadow] duration-300 ease-[var(--ease-out)]",
                            "outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2",
                            isActive ? "bg-primary text-primary shadow-xs dark:bg-tertiary" : "text-tertiary hover:text-primary",
                        )
                    }
                >
                    {tool.label}
                </NavLink>
            ))}
        </nav>
    );
}

/** Drop an image anywhere on the page, or paste one (⌘/Ctrl + V). */
function PageDropTarget() {
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
                    <p className="text-tile text-primary">Drop to open</p>
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
