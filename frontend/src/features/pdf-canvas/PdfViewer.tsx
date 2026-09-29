import { ChevronDown, ChevronUp, Download, Maximize, Minimize, PanelLeft, Printer, RotateCcw, RotateCw, Search, X } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PageThumbnail } from "@/features/documents/PageThumbnail";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { printPdfBlob, saveBlob } from "./fileActions";
import { PdfPage, type PageText } from "./PdfPage";
import { documentText, findMatches, type Match, matchRects, searchPattern } from "./search";
import { usePageScroller } from "./usePageScroller";
import { useZoom } from "./useZoom";
import { MobileBar, PageNav, PanelButton, Toolbar, ToolbarButton, ToolbarDivider, ZoomControl } from "./ViewerControls";

interface PdfViewerProps {
    /** Phones and tablets: opens the details panel (a sheet). */
    onDetails?: () => void;
    file: File;
    document: PDFDocumentProxy;
    sizes: { width: number; height: number }[];
}

const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * Reading a PDF: every page in one scrolling column (drawn as they come into view), thumbnails,
 * zoom (fit width, fit page, or a percentage — also ⌘/Ctrl + scroll or pinch), going to a page,
 * finding text, turning the view, full screen, printing and downloading. All in the browser.
 */
export function PdfViewer({ file, document, sizes, onDetails }: PdfViewerProps) {
    const t = useT();
    const copy = t.documents.viewer;
    const root = useRef<HTMLDivElement>(null);
    const [area, setArea] = useState<HTMLDivElement | null>(null);
    const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
    const [thumbnails, setThumbnails] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
    const [fullscreen, setFullscreen] = useState(false);
    const count = sizes.length;
    const scroller = usePageScroller(area, count);
    const { current, goTo, restore } = scroller;
    const zoom = useZoom(area, sizes, rotation, current);
    useLayoutEffect(() => restore(), [restore, zoom.scale, rotation]);

    // ------------------------------------------------------------------ search
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState("");
    const [matchCase, setMatchCase] = useState(false);
    const [matches, setMatches] = useState<Match[]>([]);
    const [active, setActive] = useState(0);
    const [seek, setSeek] = useState(0);
    const [texts, setTexts] = useState<ReadonlyMap<number, PageText>>(new Map());
    const searchInput = useRef<HTMLInputElement>(null);
    const caseId = useId();

    useEffect(() => {
        const pattern = searchPattern(query, matchCase);
        if (!pattern) {
            setMatches([]);
            return;
        }
        let live = true;
        const timer = window.setTimeout(() => {
            void documentText(document).then((pages) => {
                if (!live) return;
                const found = findMatches(pages, pattern);
                setMatches(found);
                // Start from the first match at or after the page being read.
                const first = Math.max(0, found.findIndex((match) => match.page >= current));
                setActive(first);
                if (found.length) setSeek((value) => value + 1);
            });
        }, 180);
        return () => {
            live = false;
            window.clearTimeout(timer);
        };
        // The page being read only picks the first match; it doesn't re-run the search.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [document, query, matchCase]);

    const step = useCallback(
        (direction: 1 | -1) => {
            if (!matches.length) return;
            setActive((index) => (index + direction + matches.length) % matches.length);
            setSeek((value) => value + 1);
        },
        [matches.length],
    );

    // A new current match: its page first; the match itself once that page's text is there.
    useEffect(() => {
        const match = matches[active];
        if (match && seek) goTo(match.page);
    }, [seek]); // eslint-disable-line react-hooks/exhaustive-deps

    const onText = useCallback((page: number, text: PageText | null) => {
        setTexts((all) => {
            const next = new Map(all);
            if (text) next.set(page, text);
            else next.delete(page);
            return next;
        });
    }, []);

    const openSearch = useCallback(() => {
        setSearching(true);
        window.requestAnimationFrame(() => {
            searchInput.current?.focus();
            searchInput.current?.select();
        });
    }, []);

    // ------------------------------------------------------------------ full screen, print, download
    useEffect(() => {
        const onChange = () => setFullscreen(window.document.fullscreenElement === root.current);
        window.document.addEventListener("fullscreenchange", onChange);
        return () => window.document.removeEventListener("fullscreenchange", onChange);
    }, []);
    const toggleFullscreen = useCallback(() => {
        if (window.document.fullscreenElement) void window.document.exitFullscreen().catch(() => undefined);
        else void root.current?.requestFullscreen?.().catch(() => undefined);
    }, []);
    const canFullscreen = typeof window.document.documentElement.requestFullscreen === "function";
    const turn = useCallback((by: 90 | -90) => setRotation((value) => (((value + by + 360) % 360) as 0 | 90 | 180 | 270)), []);

    // ------------------------------------------------------------------ keyboard, pinch
    const { zoomIn, zoomOut, fit } = zoom;
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const command = event.metaKey || event.ctrlKey;
            if (command && event.key.toLowerCase() === "f") {
                event.preventDefault();
                return openSearch();
            }
            if (command && (event.key === "=" || event.key === "+")) {
                event.preventDefault();
                return zoomIn();
            }
            if (command && event.key === "-") {
                event.preventDefault();
                return zoomOut();
            }
            if (command && event.key === "0") {
                event.preventDefault();
                return fit("width");
            }
            if (command || event.altKey || isTyping(event.target)) return;
            if (event.key === "ArrowLeft" || event.key === "k") goTo(current - 1);
            else if (event.key === "ArrowRight" || event.key === "j") goTo(current + 1);
            else if (event.key === "Home") goTo(1);
            else if (event.key === "End") goTo(count);
            else if (event.key.toLowerCase() === "r") turn(event.shiftKey ? -90 : 90);
            else if (event.key === "f" && canFullscreen) toggleFullscreen();
            else return;
            event.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openSearch, zoomIn, zoomOut, fit, goTo, current, count, turn, toggleFullscreen, canFullscreen]);

    useEffect(() => {
        const element = area;
        if (!element) return;
        // ⌘/Ctrl + wheel, and trackpad pinches (which arrive as ctrl + wheel), zoom the pages rather than the site.
        const onWheel = (event: WheelEvent) => {
            if (!event.ctrlKey && !event.metaKey) return;
            event.preventDefault();
            if (event.deltaY < 0) zoomIn();
            else zoomOut();
        };
        element.addEventListener("wheel", onWheel, { passive: false });
        return () => element.removeEventListener("wheel", onWheel);
    }, [area, zoomIn, zoomOut]);

    const matchesByPage = useMemo(() => {
        const map = new Map<number, { match: Match; index: number }[]>();
        matches.forEach((match, index) => map.set(match.page, [...(map.get(match.page) ?? []), { match, index }]));
        return map;
    }, [matches]);

    return (
        <div ref={root} className={cn("flex min-h-0 flex-1 flex-col gap-2", fullscreen && "bg-secondary p-2")}>
            <Toolbar label={copy.toolbar}>
                <ToolbarButton icon={PanelLeft} label={copy.thumbnails} pressed={thumbnails} onClick={() => setThumbnails((value) => !value)} className="hidden sm:grid" />
                <div className="hidden items-center gap-0.5 lg:flex">
                    <ToolbarDivider />
                    <PageNav current={current} count={count} onGo={(page) => goTo(page)} />
                    <ToolbarDivider />
                    <ZoomControl zoom={zoom} />
                    <ToolbarDivider />
                </div>
                <ToolbarButton icon={RotateCcw} label={copy.rotateLeft} onClick={() => turn(-90)} shortcut="Shift+R" className="hidden sm:grid" />
                <ToolbarButton icon={RotateCw} label={copy.rotateRight} onClick={() => turn(90)} shortcut="R" />
                <ToolbarButton icon={Search} label={copy.search} pressed={searching} onClick={() => (searching ? setSearching(false) : openSearch())} shortcut="Control+F" />
                <span className="ml-auto" />
                <ToolbarButton icon={Printer} label={copy.print} onClick={() => printPdfBlob(file)} />
                <ToolbarButton icon={Download} label={copy.download} onClick={() => saveBlob(file, file.name)} />
                {canFullscreen && <ToolbarButton icon={fullscreen ? Minimize : Maximize} label={fullscreen ? copy.exitFullscreen : copy.fullscreen} onClick={toggleFullscreen} shortcut="F" />}
            </Toolbar>

            {searching && (
                <div role="search" aria-label={copy.search} className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl border border-[var(--card-line)] bg-primary p-1.5">
                    <input
                        ref={searchInput}
                        type="search"
                        value={query}
                        placeholder={copy.searchPlaceholder}
                        aria-label={copy.search}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                step(event.shiftKey ? -1 : 1);
                            } else if (event.key === "Escape") setSearching(false);
                        }}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--card-line)] bg-primary px-2.5 text-sm text-primary outline-focus-ring placeholder:text-quaternary focus-visible:outline-2 pointer-coarse:h-10"
                    />
                    <span aria-live="polite" className="min-w-20 px-1 text-center text-xs text-tertiary tabular-nums">
                        {query.trim() ? (matches.length ? copy.matchCount(active + 1, matches.length) : copy.noMatches) : ""}
                    </span>
                    <ToolbarButton icon={ChevronUp} label={copy.previousMatch} onClick={() => step(-1)} disabled={!matches.length} shortcut="Shift+Enter" />
                    <ToolbarButton icon={ChevronDown} label={copy.nextMatch} onClick={() => step(1)} disabled={!matches.length} shortcut="Enter" />
                    <label htmlFor={caseId} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-1.5 text-xs font-medium text-secondary">
                        <input id={caseId} type="checkbox" checked={matchCase} onChange={(event) => setMatchCase(event.target.checked)} className="size-3.5 accent-[var(--brand)]" />
                        {copy.matchCase}
                    </label>
                    <ToolbarButton icon={X} label={copy.closeSearch} onClick={() => setSearching(false)} />
                </div>
            )}

            <div className="flex h-[62dvh] flex-none gap-2 lg:h-auto lg:min-h-0 lg:flex-1">
                {thumbnails && (
                    <nav aria-label={copy.thumbnails} className="hidden w-36 shrink-0 overflow-y-auto overscroll-contain rounded-xl border border-[var(--card-line)] bg-secondary p-2 sm:block">
                        <ol className="flex flex-col gap-3">
                            {sizes.map((size, index) => (
                                <Thumbnail key={index} document={document} page={index + 1} size={size} rotation={rotation} current={current === index + 1} onSelect={() => goTo(index + 1)} label={copy.pageLabel(index + 1)} />
                            ))}
                        </ol>
                    </nav>
                )}
                <div ref={setArea} tabIndex={0} aria-label={copy.pagesLabel} className="relative min-w-0 flex-1 overflow-auto overscroll-contain rounded-xl bg-secondary outline-focus-ring focus-visible:outline-2">
                    <div className="mx-auto flex w-max min-w-full flex-col items-center gap-4 p-4">
                        {sizes.map((size, index) => {
                            const page = index + 1;
                            return (
                                <PdfPage
                                    key={page}
                                    ref={(node) => scroller.register(page, node)}
                                    document={document}
                                    page={page}
                                    size={size}
                                    scale={zoom.scale}
                                    rotation={rotation}
                                    textLayer
                                    onText={onText}
                                    label={copy.pageLabel(page)}
                                >
                                    {searching && matchesByPage.has(page) && texts.get(page) && <MatchMarks text={texts.get(page)!} matches={matchesByPage.get(page)!} active={active} seek={seek} layout={`${zoom.scale}:${rotation}`} />}
                                </PdfPage>
                            );
                        })}
                    </div>
                </div>
            </div>
            <MobileBar label={copy.pagesBar}>
                <PageNav current={current} count={count} onGo={(page) => goTo(page)} />
                <ZoomControl zoom={zoom} compact />
                {onDetails && <PanelButton label={copy.details} onClick={onDetails} />}
            </MobileBar>
        </div>
    );
}

function Thumbnail({ document, page, size, rotation, current, onSelect, label }: { document: PDFDocumentProxy; page: number; size: { width: number; height: number }; rotation: number; current: boolean; onSelect: () => void; label: string }) {
    const item = useRef<HTMLLIElement>(null);
    useEffect(() => {
        if (current) item.current?.scrollIntoView({ block: "nearest" });
    }, [current]);
    return (
        <li ref={item}>
            <button type="button" onClick={onSelect} aria-current={current ? "page" : undefined} aria-label={label} className="group flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg p-1 outline-focus-ring focus-visible:outline-2">
                <span className={cn("block w-full rounded-md p-0.5 ring-2 transition-colors duration-150", current ? "ring-[var(--brand)]" : "ring-transparent group-hover:ring-[var(--card-line)]")}>
                    <PageThumbnail document={document} page={page} size={size} rotate={rotation} width={112} label="" />
                </span>
                <span className={cn("text-xs tabular-nums", current ? "font-semibold text-[var(--brand)]" : "text-tertiary")}>{page}</span>
            </button>
        </li>
    );
}

/** The matches on one page, drawn over its text; the current one brought into view when it changes. */
function MatchMarks({ text, matches, active, seek, layout }: { text: PageText; matches: { match: Match; index: number }[]; active: number; seek: number; layout: string }) {
    const [boxes, setBoxes] = useState<{ index: number; rects: ReturnType<typeof matchRects> }[]>([]);
    const currentMark = useRef<HTMLSpanElement>(null);
    const seen = useRef(-1);

    // Measured after the text layer has taken its new size (zoom changes it through CSS at once).
    useLayoutEffect(() => {
        const frame = requestAnimationFrame(() => setBoxes(matches.map(({ match, index }) => ({ index, rects: matchRects(text, match) }))));
        return () => cancelAnimationFrame(frame);
    }, [text, matches, layout]);

    useEffect(() => {
        if (seen.current === seek || !currentMark.current) return;
        seen.current = seek;
        currentMark.current.scrollIntoView({ block: "center", inline: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, [seek, boxes]);

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[2]">
            {boxes.flatMap(({ index, rects }) =>
                rects.map((rect, part) => (
                    <span key={`${index}-${part}`} ref={index === active && part === 0 ? currentMark : undefined} data-current={index === active || undefined} className="pdf-match" style={{ left: rect.x - 1, top: rect.y - 1, width: rect.width + 2, height: rect.height + 2 }} />
                )),
            )}
        </div>
    );
}
