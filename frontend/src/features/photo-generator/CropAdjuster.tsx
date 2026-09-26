import { Check, LoaderCircle, RotateCcw } from "lucide-react";
import { type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/base/buttons/button";
import { Range } from "@/features/background-removal/editor/RefinePanel";
import { ApiError } from "@/lib/api/apiClient";
import { adjustPhotoCrop, apiUrl, type GeneratedPhoto, type Rect, type RenderedPhoto } from "@/lib/api/photoGeneratorApi";
import { useT } from "@/i18n";
import { photoError } from "./labels";

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2;
/** How far the frame may move from the automatic crop, as a share of its size. */
const MAX_SHIFT = 0.3;

type Point = { x: number; y: number };

/**
 * Small corrections to the automatic crop: the frame stays put and the photo moves under it — drag,
 * pinch or scroll, or use the sliders. Guide lines show where the top of the head and the chin belong.
 * Full screen on phones, in the canvas on larger screens. The server renders and re-checks the result.
 */
export function CropAdjuster({ result, onApplied, onCancel }: { result: GeneratedPhoto; onApplied: (photo: RenderedPhoto & { crop: Rect }) => void; onCancel: () => void }) {
    const t = useT();
    const copy = t.photo.crop;
    const { work } = result;
    const auto = work.autoCrop;
    const aspect = auto.width / auto.height;
    const [crop, setCrop] = useState<Rect>(work.crop);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Where the head sits in the automatic crop — the lines to line it up with again.
    const crownLine = (work.head.crownY - auto.y) / auto.height;
    const chinLine = (work.head.chinY - auto.y) / auto.height;

    const areaRef = useRef<HTMLDivElement>(null);
    const [area, setArea] = useState({ width: 0, height: 0 });
    useLayoutEffect(() => {
        const element = areaRef.current;
        if (!element) return;
        const observer = new ResizeObserver(([entry]) => entry && setArea({ width: entry.contentRect.width, height: entry.contentRect.height }));
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const frameHeight = Math.max(0, Math.min(area.height * 0.84, (area.width * 0.84) / aspect));
    const frame = { width: frameHeight * aspect, height: frameHeight, left: (area.width - frameHeight * aspect) / 2, top: (area.height - frameHeight) / 2 };
    const scale = frameHeight / crop.height;

    // ------------------------------------------------------------ the crop, kept sensible
    const clamp = (next: Rect): Rect => {
        const height = Math.min(auto.height / MIN_ZOOM, Math.max(auto.height / MAX_ZOOM, next.height));
        const width = height * aspect;
        const autoX = auto.x + auto.width / 2;
        const autoY = auto.y + auto.height / 2;
        const cx = Math.min(autoX + auto.width * MAX_SHIFT, Math.max(autoX - auto.width * MAX_SHIFT, next.x + next.width / 2));
        const cy = Math.min(autoY + auto.height * MAX_SHIFT, Math.max(autoY - auto.height * MAX_SHIFT, next.y + next.height / 2));
        return { x: cx - width / 2, y: cy - height / 2, width, height };
    };
    const zoom = auto.height / crop.height;
    const shiftX = (crop.x + crop.width / 2 - (auto.x + auto.width / 2)) / auto.width;
    const shiftY = (crop.y + crop.height / 2 - (auto.y + auto.height / 2)) / auto.height;
    const setZoom = (value: number) =>
        setCrop((current) => {
            const height = auto.height / value;
            return clamp({ x: current.x + current.width / 2 - (height * aspect) / 2, y: current.y + current.height / 2 - height / 2, width: height * aspect, height });
        });
    const setShift = (axis: "x" | "y", value: number) =>
        setCrop((current) =>
            clamp(
                axis === "x"
                    ? { ...current, x: auto.x + auto.width / 2 + value * auto.width - current.width / 2 }
                    : { ...current, y: auto.y + auto.height / 2 + value * auto.height - current.height / 2 },
            ),
        );

    // ------------------------------------------------------------ drag and pinch
    const pointers = useRef(new Map<number, Point>());
    const gesture = useRef<{ start: Map<number, Point>; crop: Rect } | null>(null);
    const begin = () => (gesture.current = { start: new Map(pointers.current), crop });
    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        begin();
    };
    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        if (!pointers.current.has(event.pointerId) || !gesture.current) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const { start, crop: from } = gesture.current;
        const now = [...pointers.current.values()];
        const was = [...start.values()];
        const centre = (points: Point[]) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });
        const spread = (points: Point[]) => (points.length < 2 ? 1 : Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y));
        const fromScale = frameHeight / from.height;
        // Pinching apart zooms in: the crop gets smaller.
        const height = from.height / (now.length >= 2 && was.length >= 2 ? spread(now) / Math.max(1, spread(was)) : 1);
        const moved = { x: centre(now).x - centre(was).x, y: centre(now).y - centre(was).y };
        // Dragging the photo right moves the frame left over it.
        const cx = from.x + from.width / 2 - moved.x / fromScale;
        const cy = from.y + from.height / 2 - moved.y / fromScale;
        setCrop(clamp({ x: cx - (height * aspect) / 2, y: cy - height / 2, width: height * aspect, height }));
    };
    const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size) begin();
        else gesture.current = null;
    };

    const apply = async () => {
        setApplying(true);
        setError(null);
        try {
            onApplied(await adjustPhotoCrop(work.id, crop));
        } catch (cause) {
            setError(photoError(t, cause instanceof ApiError ? { code: cause.code ?? (cause.status === 0 ? "NETWORK" : undefined) } : null));
            setApplying(false);
        }
    };

    return (
        // Phones: a full-screen editor. Larger screens: in the canvas.
        <div role="dialog" aria-label={copy.title} className="fixed inset-0 z-50 flex flex-col bg-primary lg:static lg:z-auto lg:min-h-0 lg:flex-1 lg:bg-transparent">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--card-line)] px-4 py-3 lg:hidden">
                <h2 className="text-md font-semibold text-primary">{copy.title}</h2>
            </div>
            <div
                ref={areaRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
                onWheel={(event) => setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * Math.exp(-event.deltaY * 0.0015))))}
                className="relative min-h-0 flex-1 cursor-grab touch-none overflow-hidden bg-neutral-800 select-none active:cursor-grabbing"
            >
                {frameHeight > 0 && (
                    <>
                        {/* What's outside the photo becomes white background, so the frame is white underneath. */}
                        <span aria-hidden className="absolute bg-white" style={frame} />
                        <img
                            src={apiUrl(work.url)}
                            alt=""
                            draggable={false}
                            // The working copy lives on the server only for a while (and not across restarts).
                            onError={() => setError(photoError(t, { code: "FILE_EXPIRED" }))}
                            className="pointer-events-none absolute max-w-none"
                            style={{ left: frame.left - crop.x * scale, top: frame.top - crop.y * scale, width: work.width * scale, height: work.height * scale }}
                        />
                        <div aria-label={copy.frame} className="pointer-events-none absolute ring-2 ring-white shadow-[0_0_0_9999px_rgb(24_24_27/0.62)]" style={frame}>
                            <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-sky-300/90" style={{ top: `${crownLine * 100}%` }} />
                            <span aria-hidden className="absolute inset-x-0 border-t border-dashed border-sky-300/90" style={{ top: `${chinLine * 100}%` }} />
                            <span aria-hidden className="absolute inset-y-0 left-1/2 border-l border-dashed border-white/40" />
                        </div>
                    </>
                )}
            </div>
            <div className="flex flex-col gap-4 border-t border-[var(--card-line)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:rounded-b-xl lg:border-t-0 lg:bg-primary">
                <p className="text-xs text-tertiary">{copy.hint}</p>
                <div className="grid gap-4 sm:grid-cols-3">
                    <Range label={copy.zoom} value={Math.round(zoom * 100)} min={MIN_ZOOM * 100} max={MAX_ZOOM * 100} onChange={(value) => setZoom(value / 100)} format={(value) => `${value}%`} />
                    <Range label={copy.horizontal} value={Math.round(shiftX * 100)} min={-MAX_SHIFT * 100} max={MAX_SHIFT * 100} onChange={(value) => setShift("x", value / 100)} format={(value) => `${value > 0 ? "+" : ""}${value}`} />
                    <Range label={copy.vertical} value={Math.round(shiftY * 100)} min={-MAX_SHIFT * 100} max={MAX_SHIFT * 100} onChange={(value) => setShift("y", value / 100)} format={(value) => `${value > 0 ? "+" : ""}${value}`} />
                </div>
                {error && (
                    <p role="alert" className="text-sm text-error-primary">
                        {error}
                    </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button size="md" color="tertiary" iconLeading={RotateCcw} onPress={() => setCrop(auto)} isDisabled={applying} className="press-scale pointer-coarse:min-h-12">
                        {copy.reset}
                    </Button>
                    <div className="flex gap-2">
                        <Button size="md" color="secondary" onPress={onCancel} isDisabled={applying} className="press-scale pointer-coarse:min-h-12">
                            {copy.cancel}
                        </Button>
                        <Button size="md" color="primary" iconLeading={applying ? undefined : Check} onPress={() => void apply()} isDisabled={applying} className="press-scale pointer-coarse:min-h-12">
                            <span className="flex items-center gap-2">
                                {applying && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                                {applying ? copy.applying : copy.apply}
                            </span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
