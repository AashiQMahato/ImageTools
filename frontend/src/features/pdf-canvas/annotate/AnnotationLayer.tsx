import { Trash2 } from "lucide-react";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useT } from "@/i18n";
import { type Annotation, angleAround, type Box, bounds, LINE_HEIGHT, mergeLineRects, moved, newId, refit, resizeBox, TEXT_FONT, type TextAnnotation } from "./model";
import type { Annotator } from "./useAnnotator";

interface AnnotationLayerProps {
    annotator: Annotator;
    page: number;
    /** The page in points, as displayed. */
    size: { width: number; height: number };
    /** CSS pixels per point. */
    scale: number;
    /** Today's date as the reader writes it (the Date tool). */
    today: string;
}

type Point = { x: number; y: number };

const MARKUP = new Set(["highlight", "underline", "strike"]);
const CREATE = new Set(["text", "date", "draw", "rect", "ellipse", "line", "arrow"]);

/** Follows one drag: every move and the release, anywhere on screen. */
function drag(event: ReactPointerEvent | PointerEvent, toPoint: (event: PointerEvent) => Point, onMove: (point: Point, event: PointerEvent) => void, onEnd: (point: Point, event: PointerEvent) => void) {
    const pointer = event.pointerId;
    const move = (next: PointerEvent) => next.pointerId === pointer && onMove(toPoint(next), next);
    const end = (next: PointerEvent) => {
        if (next.pointerId !== pointer) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        onEnd(toPoint(next), next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
}

/**
 * One page's edits, over the page: drawn as they'll be saved, and worked with directly — the active
 * tool creates (click or drag), the select tool picks, moves, resizes and turns; text is typed in
 * place. Highlight, underline and strike-through follow a text selection (or a dragged box on scans).
 */
export function AnnotationLayer({ annotator, page, size, scale, today }: AnnotationLayerProps) {
    const t = useT();
    const copy = t.documents.editor;
    const layer = useRef<HTMLDivElement>(null);
    const { tool, style } = annotator;
    const items = annotator.byPage.get(page) ?? [];
    const selected = annotator.selected?.page === page ? annotator.selected : null;
    const [markBox, setMarkBox] = useState<Box | null>(null);

    const toPoint = (event: { clientX: number; clientY: number }): Point => {
        const rect = layer.current!.getBoundingClientRect();
        return { x: Math.min(size.width, Math.max(0, (event.clientX - rect.left) / scale)), y: Math.min(size.height, Math.max(0, (event.clientY - rect.top) / scale)) };
    };

    // ------------------------------------------------------------------ creating
    const onLayerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        if (tool === "select") {
            if (event.target === layer.current) annotator.select(null);
            return;
        }
        if (!CREATE.has(tool)) return;
        event.preventDefault();
        // A click away from the text being typed finishes it (rather than starting another).
        if (annotator.editing) {
            (window.document.activeElement as HTMLElement | null)?.blur();
            return;
        }
        const start = toPoint(event);
        const id = newId();
        if (tool === "text" || tool === "date") {
            const text = tool === "date" ? today : "";
            const base: TextAnnotation = { id, page, kind: "text", x: start.x, y: Math.max(0, start.y - style.textSize * LINE_HEIGHT * 0.5), width: 0, height: 0, rotation: 0, text, size: style.textSize, color: style.color, bold: style.bold };
            const item = refit(base);
            if (tool === "date") {
                annotator.add(item);
                annotator.setTool("select");
                annotator.select(item.id);
            } else {
                annotator.setDraft(item);
                annotator.select(id);
                annotator.setEditing(id);
            }
            return;
        }
        if (tool === "draw") {
            const stroke: [number, number][] = [[start.x, start.y]];
            const make = (): Annotation => ({ id, page, kind: "ink", strokes: [[...stroke]], color: style.inkColor, width: style.inkWidth, opacity: style.opacity });
            annotator.setDraft(make());
            drag(
                event,
                toPoint,
                (point) => {
                    const last = stroke[stroke.length - 1]!;
                    // Points closer than a quarter point add nothing but weight.
                    if (Math.hypot(point.x - last[0], point.y - last[1]) < 0.25) return;
                    stroke.push([point.x, point.y]);
                    annotator.setDraft(make());
                },
                () => {
                    if (stroke.length === 1) stroke.push([stroke[0]![0] + 0.1, stroke[0]![1] + 0.1]);
                    annotator.setDraft(make());
                    annotator.commitDraft();
                },
            );
            return;
        }
        // Shapes and lines: dragged out; a click makes one at a standard size.
        const shape = (end: Point, shift: boolean): Annotation => {
            if (tool === "line" || tool === "arrow") {
                let x2 = end.x;
                let y2 = end.y;
                if (shift) {
                    // Snap to 45° steps.
                    const angle = Math.round(Math.atan2(y2 - start.y, x2 - start.x) / (Math.PI / 4)) * (Math.PI / 4);
                    const length = Math.hypot(x2 - start.x, y2 - start.y);
                    x2 = start.x + Math.cos(angle) * length;
                    y2 = start.y + Math.sin(angle) * length;
                }
                return { id, page, kind: tool, x1: start.x, y1: start.y, x2, y2, stroke: style.stroke, strokeWidth: style.strokeWidth, opacity: style.opacity };
            }
            let width = Math.abs(end.x - start.x);
            let height = Math.abs(end.y - start.y);
            if (shift) width = height = Math.max(width, height);
            return { id, page, kind: tool as "rect" | "ellipse", x: end.x < start.x ? start.x - width : start.x, y: end.y < start.y ? start.y - height : start.y, width, height, stroke: style.stroke, strokeWidth: style.strokeWidth, fill: style.fill, opacity: style.opacity };
        };
        annotator.setDraft(shape(start, false));
        drag(
            event,
            toPoint,
            (point, next) => annotator.setDraft(shape(point, next.shiftKey)),
            (point, next) => {
                const small = Math.hypot(point.x - start.x, point.y - start.y) < 3;
                annotator.setDraft(small ? shape({ x: start.x + 120, y: start.y + (tool === "line" || tool === "arrow" ? 0 : 72) }, false) : shape(point, next.shiftKey));
                annotator.commitDraft();
                annotator.setTool("select");
                // The new shape is selected: its settings are right there to adjust.
                annotator.select(id);
            },
        );
    };

    // ------------------------------------------------------------------ highlight, underline, strike-through
    useEffect(() => {
        const pageElement = layer.current?.parentElement;
        if (!pageElement || !MARKUP.has(tool)) return;
        let start: Point | null = null;
        const onDown = (event: PointerEvent) => {
            if (event.button === 0) start = toPoint(event);
        };
        const onMove = (event: PointerEvent) => {
            if (!start || event.buttons !== 1) return;
            // A text selection shows itself; on a page without text, the dragged box stands in.
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.toString().trim()) return setMarkBox(null);
            const point = toPoint(event);
            setMarkBox({ x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) });
        };
        const onUp = (event: PointerEvent) => {
            if (!start) return;
            const from = start;
            start = null;
            setMarkBox(null);
            const end = toPoint(event);
            const origin = pageElement.getBoundingClientRect();
            const selection = window.getSelection();
            let rects: Box[] = [];
            if (selection && !selection.isCollapsed && selection.toString().trim()) {
                for (let index = 0; index < selection.rangeCount; index++) {
                    for (const rect of selection.getRangeAt(index).getClientRects()) {
                        if (rect.width < 1 || rect.height < 1 || rect.right < origin.left || rect.left > origin.right || rect.bottom < origin.top || rect.top > origin.bottom) continue;
                        const x = Math.max(0, (rect.left - origin.left) / scale);
                        const y = Math.max(0, (rect.top - origin.top) / scale);
                        rects.push({ x, y, width: Math.min(size.width, (rect.right - origin.left) / scale) - x, height: Math.min(size.height, (rect.bottom - origin.top) / scale) - y });
                    }
                }
                rects = mergeLineRects(rects).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
                selection.removeAllRanges();
            } else if (Math.abs(end.x - from.x) > 4 && Math.abs(end.y - from.y) > 2) {
                rects = [{ x: Math.min(from.x, end.x), y: Math.min(from.y, end.y), width: Math.abs(end.x - from.x), height: Math.abs(end.y - from.y) }];
            }
            if (rects.length) annotator.add({ page, kind: tool as "highlight", rects: rects.slice(0, 500), color: tool === "highlight" ? style.markColor : style.stroke }, false);
        };
        pageElement.addEventListener("pointerdown", onDown);
        pageElement.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        return () => {
            pageElement.removeEventListener("pointerdown", onDown);
            pageElement.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
        // toPoint reads the current scale and size; both are dependencies.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool, scale, size.width, size.height, page, style.markColor, style.stroke, annotator.add]);

    // ------------------------------------------------------------------ moving, resizing, turning
    const startMove = (event: ReactPointerEvent, item: Annotation) => {
        if (tool !== "select" || event.button !== 0 || annotator.editing === item.id) return;
        event.stopPropagation();
        event.preventDefault();
        annotator.select(item.id);
        const start = toPoint(event);
        let last: Annotation | null = null;
        drag(
            event,
            toPoint,
            (point) => {
                last = moved(item, point.x - start.x, point.y - start.y);
                annotator.setDraft(last);
            },
            () => (last ? annotator.commitDraft() : annotator.setDraft(null)),
        );
    };

    const startHandle = (event: ReactPointerEvent, item: Annotation, handle: string) => {
        event.stopPropagation();
        event.preventDefault();
        let changed = false;
        drag(
            event,
            toPoint,
            (point, next) => {
                changed = true;
                if (item.kind === "line" || item.kind === "arrow") {
                    annotator.setDraft(handle === "start" ? { ...item, x1: point.x, y1: point.y } : { ...item, x2: point.x, y2: point.y });
                } else if (handle === "turn" && (item.kind === "text" || item.kind === "image")) {
                    annotator.setDraft({ ...item, rotation: angleAround(item, point, !next.shiftKey) });
                } else if (item.kind === "text" || item.kind === "image" || item.kind === "rect" || item.kind === "ellipse") {
                    const [sx, sy] = handle.split(",").map(Number) as [number, number];
                    const box = resizeBox(item, sx, sy, point, item.kind !== "rect" && item.kind !== "ellipse" ? true : next.shiftKey, item.kind === "text" ? 6 : 4);
                    if (item.kind === "text") {
                        // Text resizes by its type size.
                        const size = Math.min(300, Math.max(4, Math.round(item.size * (box.width / item.width) * 2) / 2));
                        annotator.setDraft(refit({ ...item, x: box.x, y: box.y }, { size }));
                    } else annotator.setDraft({ ...item, ...box });
                }
            },
            () => (changed ? annotator.commitDraft() : annotator.setDraft(null)),
        );
    };

    const interactive = tool === "select";
    return (
        <div
            ref={layer}
            onPointerDown={onLayerDown}
            className={cn("absolute inset-0", MARKUP.has(tool) && "pointer-events-none")}
            style={{ zIndex: 2, cursor: tool === "text" || tool === "date" ? "text" : CREATE.has(tool) ? "crosshair" : undefined, touchAction: CREATE.has(tool) ? "none" : undefined }}
        >
            {items.map((item) =>
                annotator.editing === item.id && item.kind === "text" ? (
                    <TextEditor key={item.id} item={item} scale={scale} annotator={annotator} placeholder={copy.typeHere} />
                ) : (
                    <AnnotationView key={item.id} item={item} scale={scale} size={size} picture={item.kind === "image" ? annotator.pictures.get(item.image)?.url : undefined} interactive={interactive} onPointerDown={(event) => startMove(event, item)} onDoubleClick={() => item.kind === "text" && annotator.setEditing(item.id)} />
                ),
            )}
            {markBox && <div className="pointer-events-none absolute rounded-sm border border-dashed border-[var(--brand)] bg-[var(--brand)]/10" style={{ left: markBox.x * scale, top: markBox.y * scale, width: markBox.width * scale, height: markBox.height * scale }} />}
            {selected && interactive && annotator.editing !== selected.id && <SelectionFrame item={selected} scale={scale} onHandle={(event, handle) => startHandle(event, selected, handle)} onMove={(event) => startMove(event, selected)} onDelete={() => annotator.remove(selected.id)} deleteLabel={copy.deleteItem} />}
        </div>
    );
}

// ------------------------------------------------------------------ drawing

const px = (value: number, scale: number) => value * scale;

function arrowHead(item: { x1: number; y1: number; x2: number; y2: number; strokeWidth: number }) {
    const angle = Math.atan2(item.y2 - item.y1, item.x2 - item.x1);
    const length = Math.max(8, item.strokeWidth * 4);
    return [-1, 1].map((side) => {
        const a = angle + Math.PI - (side * 28 * Math.PI) / 180;
        return `M${item.x2} ${item.y2} L${item.x2 + Math.cos(a) * length} ${item.y2 + Math.sin(a) * length}`;
    });
}

const inkPath = (stroke: [number, number][]) => stroke.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");

interface ViewProps {
    item: Annotation;
    scale: number;
    size: { width: number; height: number };
    picture?: string;
    interactive: boolean;
    onPointerDown: (event: ReactPointerEvent) => void;
    onDoubleClick: () => void;
}

/** An edit as it will look in the saved PDF. */
function AnnotationView({ item, scale, size, picture, interactive, onPointerDown, onDoubleClick }: ViewProps) {
    const events = interactive ? { onPointerDown, onDoubleClick } : {};
    const hit: CSSProperties = { pointerEvents: interactive ? "auto" : "none", cursor: interactive ? "move" : undefined, touchAction: interactive ? "none" : undefined };
    const boxStyle = (box: Box, rotation = 0): CSSProperties => ({ position: "absolute", left: px(box.x, scale), top: px(box.y, scale), width: px(box.width, scale), height: px(box.height, scale), transform: rotation ? `rotate(${rotation}deg)` : undefined });

    switch (item.kind) {
        case "text":
            return (
                <div
                    {...events}
                    data-annotation={item.id}
                    lang={/[ऀ-ॿ]/.test(item.text) ? "ne" : undefined}
                    className="whitespace-pre select-none"
                    style={{ ...boxStyle(item, item.rotation), ...hit, fontFamily: TEXT_FONT, fontSize: px(item.size, scale), lineHeight: LINE_HEIGHT, fontWeight: item.bold ? 700 : 400, color: item.color }}
                >
                    {item.text}
                </div>
            );
        case "image":
            return picture ? <img {...events} data-annotation={item.id} src={picture} alt="" draggable={false} className="select-none" style={{ ...boxStyle(item, item.rotation), ...hit, opacity: item.opacity }} /> : null;
        case "highlight":
        case "underline":
        case "strike":
            return (
                <>
                    {item.rects.map((rect, index) => {
                        if (item.kind === "highlight") return <div key={index} {...events} data-annotation={item.id} style={{ ...boxStyle(rect), ...hit, background: item.color, opacity: 0.45, mixBlendMode: "multiply" }} />;
                        const bar = { x: rect.x, y: rect.y + rect.height * (item.kind === "underline" ? 0.9 : 0.52), width: rect.width, height: Math.max(0.75, rect.height * 0.07) };
                        const thickness = Math.max(1, px(bar.height, scale));
                        // A few pixels either side of the line take the pointer, so a thin line is easy to pick.
                        return (
                            <div key={index} {...events} data-annotation={item.id} style={{ position: "absolute", left: px(bar.x, scale), top: px(bar.y, scale) - 4, width: px(bar.width, scale), height: thickness + 8, ...hit }}>
                                <span className="absolute inset-x-0" style={{ top: 4, height: thickness, background: item.color }} />
                            </div>
                        );
                    })}
                </>
            );
        default: {
            // Vector edits: an SVG the size of the page, in points.
            const shape = (() => {
                switch (item.kind) {
                    case "ink":
                        return item.strokes.map((stroke, index) => (
                            <g key={index}>
                                <path d={inkPath(stroke)} fill="none" stroke="transparent" strokeWidth={Math.max(item.width, 10 / scale)} strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: interactive ? "stroke" : "none" }} {...events} />
                                <path d={inkPath(stroke)} fill="none" stroke={item.color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round" opacity={item.opacity} pointerEvents="none" />
                            </g>
                        ));
                    case "rect":
                        return <rect x={item.x} y={item.y} width={item.width} height={item.height} fill={item.fill ?? "transparent"} fillOpacity={item.fill ? item.opacity : 1} stroke={item.strokeWidth ? item.stroke : "none"} strokeWidth={item.strokeWidth} strokeOpacity={item.opacity} style={{ pointerEvents: interactive ? "visiblePainted" : "none" }} {...events} />;
                    case "ellipse":
                        return <ellipse cx={item.x + item.width / 2} cy={item.y + item.height / 2} rx={item.width / 2} ry={item.height / 2} fill={item.fill ?? "transparent"} fillOpacity={item.fill ? item.opacity : 1} stroke={item.strokeWidth ? item.stroke : "none"} strokeWidth={item.strokeWidth} strokeOpacity={item.opacity} style={{ pointerEvents: interactive ? "visiblePainted" : "none" }} {...events} />;
                    case "line":
                    case "arrow": {
                        const d = [`M${item.x1} ${item.y1} L${item.x2} ${item.y2}`, ...(item.kind === "arrow" ? arrowHead(item) : [])].join(" ");
                        return (
                            <>
                                <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(item.strokeWidth, 10 / scale)} strokeLinecap="round" style={{ pointerEvents: interactive ? "stroke" : "none" }} {...events} />
                                <path d={d} fill="none" stroke={item.stroke} strokeWidth={item.strokeWidth} strokeLinecap="round" opacity={item.opacity} pointerEvents="none" />
                            </>
                        );
                    }
                }
            })();
            return (
                <svg data-annotation={item.id} className="pointer-events-none absolute inset-0 overflow-visible" width={px(size.width, scale)} height={px(size.height, scale)} viewBox={`0 0 ${size.width} ${size.height}`} style={{ cursor: interactive ? "move" : undefined, touchAction: interactive ? "none" : undefined }}>
                    {shape}
                </svg>
            );
        }
    }
}

/** Typing into a text box, in place: the box grows with the text; an empty box is dropped. */
function TextEditor({ item, scale, annotator, placeholder }: { item: TextAnnotation; scale: number; annotator: Annotator; placeholder: string }) {
    const field = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        const element = field.current;
        if (!element) return;
        element.focus({ preventScroll: true });
        element.setSelectionRange(element.value.length, element.value.length);
    }, []);
    const finish = () => {
        annotator.setEditing(null);
        if (!field.current?.value.trim()) {
            annotator.discardDraft(item.id);
            return;
        }
        annotator.commitDraft();
    };
    return (
        <textarea
            ref={field}
            value={item.text}
            placeholder={placeholder}
            aria-label={placeholder}
            spellCheck={false}
            wrap="off"
            onChange={(event) => annotator.setDraft(refit(item, { text: event.target.value.slice(0, 5000) }))}
            onBlur={finish}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
                    event.preventDefault();
                    field.current?.blur();
                }
            }}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre outline-2 outline-offset-2 outline-[var(--brand)] outline-dashed placeholder:text-black/35"
            style={{
                left: px(item.x, scale),
                top: px(item.y, scale),
                width: Math.max(px(item.width, scale), 40),
                height: px(item.height, scale),
                transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                fontFamily: TEXT_FONT,
                fontSize: px(item.size, scale),
                lineHeight: LINE_HEIGHT,
                fontWeight: item.bold ? 700 : 400,
                color: item.color,
                caretColor: item.color,
            }}
        />
    );
}

const HANDLES: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
];

/** The selected edit's frame: corner handles to resize, a handle above to turn, a delete button. */
function SelectionFrame({ item, scale, onHandle, onMove, onDelete, deleteLabel }: { item: Annotation; scale: number; onHandle: (event: ReactPointerEvent, handle: string) => void; onMove: (event: ReactPointerEvent) => void; onDelete: () => void; deleteLabel: string }) {
    const handle = "absolute size-2.5 rounded-[3px] border-[1.5px] border-[var(--brand)] bg-white shadow-sm pointer-coarse:size-4";
    if (item.kind === "line" || item.kind === "arrow") {
        return (
            <>
                {(
                    [
                        ["start", item.x1, item.y1],
                        ["end", item.x2, item.y2],
                    ] as const
                ).map(([name, x, y]) => (
                    <span key={name} className={cn(handle, "-translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full")} style={{ left: x * scale, top: y * scale, touchAction: "none" }} onPointerDown={(event) => onHandle(event, name)} />
                ))}
                <DeleteButton style={{ left: Math.max(item.x1, item.x2) * scale + 8, top: Math.min(item.y1, item.y2) * scale - 32 }} onDelete={onDelete} label={deleteLabel} />
            </>
        );
    }
    const box = bounds(item);
    const rotation = item.kind === "text" || item.kind === "image" ? item.rotation : 0;
    const resizable = item.kind === "text" || item.kind === "image" || item.kind === "rect" || item.kind === "ellipse";
    const turnable = item.kind === "text" || item.kind === "image";
    return (
        <div className="pointer-events-none absolute" style={{ left: box.x * scale - 3, top: box.y * scale - 3, width: box.width * scale + 6, height: box.height * scale + 6, transform: rotation ? `rotate(${rotation}deg)` : undefined }}>
            <div className="pointer-events-auto absolute inset-0 cursor-move rounded-[3px] border-[1.5px] border-[var(--brand)]" style={{ touchAction: "none", background: "transparent" }} onPointerDown={onMove} />
            {resizable &&
                HANDLES.map(([sx, sy]) => (
                    <span
                        key={`${sx},${sy}`}
                        className={cn(handle, "pointer-events-auto -translate-x-1/2 -translate-y-1/2", sx === sy ? "cursor-nwse-resize" : "cursor-nesw-resize")}
                        style={{ left: sx < 0 ? 0 : "100%", top: sy < 0 ? 0 : "100%", touchAction: "none" }}
                        onPointerDown={(event) => onHandle(event, `${sx},${sy}`)}
                    />
                ))}
            {turnable && (
                <>
                    <span aria-hidden className="absolute left-1/2 h-5 w-px -translate-x-1/2 bg-[var(--brand)]" style={{ top: -20 }} />
                    <span className={cn(handle, "pointer-events-auto left-1/2 -translate-x-1/2 cursor-grab rounded-full")} style={{ top: -28, touchAction: "none" }} onPointerDown={(event) => onHandle(event, "turn")} />
                </>
            )}
            <DeleteButton style={{ right: -36, top: -4 }} onDelete={onDelete} label={deleteLabel} />
        </div>
    );
}

function DeleteButton({ style, onDelete, label }: { style: CSSProperties; onDelete: () => void; label: string }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onDelete}
            className="pointer-events-auto absolute grid size-7 cursor-pointer place-items-center rounded-lg border border-[var(--card-line)] bg-primary text-secondary shadow-md outline-focus-ring hover:text-error-primary focus-visible:outline-2 pointer-coarse:size-9"
            style={style}
        >
            <Trash2 className="size-3.5" aria-hidden />
        </button>
    );
}
