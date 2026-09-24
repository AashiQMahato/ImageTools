import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaqItem } from "@/components/landing/FaqSection";
import { useInView } from "@/hooks/useInView";
import { type ToolGuide, useT } from "@/i18n";
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
    guide: ToolGuide;
    children: ReactNode;
}

/**
 * Shared frame for every tool: breadcrumb, a centred header on a soft glow, the tool switcher,
 * the workspace, then a short guide (how to use, best for, tips) and questions — plus page-wide drop / paste.
 */
export function ToolPage({ name, badge, title, description, guide, children }: ToolPageProps) {
    const t = useT();
    return (
        <>
            <section className="hero-glow -mt-16 pt-16">
                <div className="page-container pt-8 pb-10 md:pt-12 md:pb-12">
                    <nav aria-label={t.toolPage.breadcrumb} className="animate-enter [--i:0]">
                        <ol className="flex items-center gap-2 text-[0.8125rem] text-tertiary">
                            <li>
                                <Link to={ROUTES.home} className="rounded transition-colors hover:text-primary outline-focus-ring focus-visible:outline-2">
                                    {t.toolPage.home}
                                </Link>
                            </li>
                            <li aria-hidden className="text-quaternary">
                                /
                            </li>
                            <li aria-current="page" className="font-medium text-primary">
                                {name}
                            </li>
                        </ol>
                    </nav>

                    <header className="mt-8 flex flex-col items-center text-center">
                        <p className="animate-enter section-badge [--i:1]">{badge}</p>
                        <h1 className="animate-enter mt-5 text-chapter text-balance text-primary [--i:2]">{title}</h1>
                        <p className="animate-enter mt-4 max-w-2xl text-lead text-pretty text-tertiary [--i:3]">{description}</p>
                        <div className="animate-enter mt-7 max-w-full [--i:4]">
                            <ToolSwitcher />
                        </div>
                    </header>
                </div>
            </section>

            <section aria-label={t.toolPage.workspace(name)} className="page-container">
                <div className="animate-enter [--i:5]">{children}</div>
            </section>

            <ToolGuideSection guide={guide} />
            <PageDropTarget />
        </>
    );
}

function ToolGuideSection({ guide }: { guide: ToolGuide }) {
    const t = useT();
    const [ref, inView] = useInView<HTMLElement>();
    const [open, setOpen] = useState<number | null>(null);
    const bullet = <span aria-hidden className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-[var(--indigo)]" />;

    return (
        <section ref={ref} data-inview={inView} aria-labelledby="guide-title" className="page-container py-20 md:py-24">
            <div className="max-w-2xl">
                <p className="reveal section-badge">{t.toolPage.guideBadge}</p>
                <h2 id="guide-title" className="reveal mt-4 text-section text-balance text-primary [--i:1]">
                    {t.toolPage.guideTitle}
                </h2>
            </div>

            <div className="mt-10 grid gap-5 md:mt-12 lg:grid-cols-3 lg:gap-6">
                <GuideCard title={t.toolPage.howTo} index={2}>
                    <ol className="flex flex-col gap-3">
                        {guide.howTo.map((step, i) => (
                            <li key={step} className="flex gap-3 text-[0.9375rem] leading-relaxed text-tertiary">
                                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--indigo-soft)] text-xs font-semibold text-[var(--indigo)]">{i + 1}</span>
                                {step}
                            </li>
                        ))}
                    </ol>
                </GuideCard>
                <GuideCard title={t.toolPage.bestFor} index={3}>
                    <ul className="flex flex-col gap-3">
                        {guide.bestFor.map((item) => (
                            <li key={item} className="flex gap-3 text-[0.9375rem] leading-relaxed text-tertiary">
                                {bullet}
                                {item}
                            </li>
                        ))}
                    </ul>
                </GuideCard>
                <GuideCard title={t.toolPage.tips} index={4}>
                    <ul className="flex flex-col gap-3">
                        {guide.tips.map((tip) => (
                            <li key={tip} className="flex gap-3 text-[0.9375rem] leading-relaxed text-tertiary">
                                {bullet}
                                {tip}
                            </li>
                        ))}
                    </ul>
                </GuideCard>
            </div>

            <div className="reveal card mt-6 grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 [--i:5]">
                <div>
                    <p className="section-badge">{t.toolPage.questionsBadge}</p>
                    <h3 className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-primary">{t.toolPage.goodToKnow}</h3>
                    <p className="mt-2 text-[0.9375rem] text-tertiary">
                        {t.toolPage.moreAnswers}{" "}
                        <Link to={`${ROUTES.home}#faq`} className="link-accent font-medium">
                            {t.toolPage.mainFaq}
                        </Link>
                        .
                    </p>
                </div>
                <div className="divide-y divide-[var(--card-line)]">
                    {guide.faqs.map((item, index) => (
                        <FaqItem key={item.q} question={item.q} answer={item.a} open={open === index} onToggle={() => setOpen(open === index ? null : index)} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function GuideCard({ title, index, children }: { title: string; index: number; children: ReactNode }) {
    return (
        <div className="reveal card p-6 sm:p-7" style={{ "--i": index } as CSSProperties}>
            <h3 className="text-lg font-semibold text-primary">{title}</h3>
            <div className="mt-4">{children}</div>
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
