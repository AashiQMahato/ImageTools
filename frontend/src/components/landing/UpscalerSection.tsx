import { type KeyboardEvent, type PointerEvent, type Ref, useEffect, useRef, useState } from "react";
import { gooseDetail, images } from "@/assets/images/landing";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils/cn";
import { SectionHeading } from "./SectionHeading";

/** Lens width as a fraction of the photo's width. */
const LENS_WIDTH = 0.2;
/** Start with the lens over the eye. */
const INITIAL_CENTER = { x: 0.615, y: 0.3 };

interface Point {
    x: number;
    y: number;
}

export function UpscalerSection() {
    const [ref, inView] = useInView<HTMLElement>();
    const panelRef = useRef<HTMLDivElement>(null);
    const [panelAspect, setPanelAspect] = useState(1);

    // The lens keeps the panel's shape, so its height (as a fraction of the photo) depends on the panel aspect.
    const lens = { width: LENS_WIDTH, height: Math.min(0.95, (LENS_WIDTH * gooseDetail.aspect) / panelAspect) };
    const clampOrigin = (point: Point): Point => ({
        x: Math.min(1 - lens.width, Math.max(0, point.x)),
        y: Math.min(1 - lens.height, Math.max(0, point.y)),
    });

    const [origin, setOrigin] = useState<Point>(() => ({
        x: INITIAL_CENTER.x - lens.width / 2,
        y: INITIAL_CENTER.y - lens.height / 2,
    }));
    const clampedOrigin = clampOrigin(origin);

    useEffect(() => {
        const panel = panelRef.current;
        if (!panel) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry) setPanelAspect(entry.contentRect.width / entry.contentRect.height);
        });
        observer.observe(panel);
        return () => observer.disconnect();
    }, []);

    // Dragging a panel pans the view, like moving the photo under a loupe.
    const pan = useRef<{ id: number; x: number; y: number; start: Point } | null>(null);
    const onPanStart = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: clampedOrigin };
    };
    const onPanMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = pan.current;
        if (!current || current.id !== event.pointerId) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const dx = ((event.clientX - current.x) / rect.width) * lens.width;
        const dy = ((event.clientY - current.y) / rect.height) * lens.height;
        setOrigin(clampOrigin({ x: current.start.x - dx, y: current.start.y - dy }));
    };
    const onPanEnd = () => {
        pan.current = null;
    };

    return (
        // Always dark: a "pro" band that lets the photo's highlights carry the section.
        <section ref={ref} data-inview={inView} aria-labelledby="upscale-title" data-nav-dark className="dark-mode bg-primary py-28 text-primary md:py-44">
            <div className="page-container">
                <SectionHeading
                    id="upscale-title"
                    align="center"
                    eyebrow="Upscale"
                    title={
                        <>
                            Bring back the detail.
                            <br />
                            <span className="text-quaternary">Every feather of it.</span>
                        </>
                    }
                    description="Enlarge small or low-resolution images so they hold up on large screens, product pages and print."
                />

                <div className="reveal relative mt-14 md:mt-24 [--i:3]">
                    <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-[1.75rem] bg-black shadow-canvas">
                        <Loupe
                            ref={panelRef}
                            src={gooseDetail.low}
                            label="Original"
                            labelSide="left"
                            lens={lens}
                            origin={clampedOrigin}
                            onPointerDown={onPanStart}
                            onPointerMove={onPanMove}
                            onPointerUp={onPanEnd}
                            onPointerCancel={onPanEnd}
                        />
                        <Loupe
                            src={gooseDetail.high}
                            label="Upscaled"
                            labelSide="right"
                            lens={lens}
                            origin={clampedOrigin}
                            onPointerDown={onPanStart}
                            onPointerMove={onPanMove}
                            onPointerUp={onPanEnd}
                            onPointerCancel={onPanEnd}
                        />
                    </div>

                    <Navigator lens={lens} origin={clampedOrigin} onChange={(point) => setOrigin(clampOrigin(point))} />
                </div>

                <p className="reveal mt-6 text-center text-xs text-quaternary md:mt-8 [--i:4]">
                    Illustrative preview. The original is shown from a copy of the photo at one-sixth resolution. Drag to explore.
                </p>
            </div>
        </section>
    );
}

interface LoupeProps {
    ref?: Ref<HTMLDivElement>;
    src: string;
    label: string;
    labelSide: "left" | "right";
    lens: { width: number; height: number };
    origin: Point;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
}

function Loupe({ ref, src, label, labelSide, lens, origin, ...handlers }: LoupeProps) {
    const x = lens.width >= 1 ? 0 : (origin.x / (1 - lens.width)) * 100;
    const y = lens.height >= 1 ? 0 : (origin.y / (1 - lens.height)) * 100;

    return (
        <div
            ref={ref}
            role="img"
            aria-label={`${label}: close-up of the goose's eye and feathers`}
            className="relative aspect-[3/4] cursor-grab touch-none bg-canvas bg-no-repeat active:cursor-grabbing sm:aspect-square"
            style={{
                backgroundImage: `url(${src})`,
                backgroundSize: `${100 / lens.width}% ${100 / lens.height}%`,
                backgroundPosition: `${x}% ${y}%`,
            }}
            {...handlers}
        >
            <span
                className={cn(
                    "pointer-events-none absolute top-4 rounded-full bg-neutral-950/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-md md:top-6",
                    labelSide === "left" ? "left-4 md:left-6" : "right-4 md:right-6",
                )}
            >
                {label}
            </span>
        </div>
    );
}

interface NavigatorProps {
    lens: { width: number; height: number };
    origin: Point;
    onChange: (origin: Point) => void;
}

/** A thumbnail of the whole photo; drag the frame (or click anywhere) to choose what the loupes show. */
function Navigator({ lens, origin, onChange }: NavigatorProps) {
    const drag = useRef<{ id: number; grab: Point } | null>(null);

    const pointFromEvent = (event: PointerEvent<HTMLDivElement>): Point => {
        const rect = event.currentTarget.getBoundingClientRect();
        return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
    };

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        const point = pointFromEvent(event);
        const insideLens =
            point.x >= origin.x && point.x <= origin.x + lens.width && point.y >= origin.y && point.y <= origin.y + lens.height;
        // Respect where the frame was grabbed; clicking outside it centres the frame on the pointer.
        const grab = insideLens ? { x: point.x - origin.x, y: point.y - origin.y } : { x: lens.width / 2, y: lens.height / 2 };
        drag.current = { id: event.pointerId, grab };
        onChange({ x: point.x - grab.x, y: point.y - grab.y });
    };

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const point = pointFromEvent(event);
        onChange({ x: point.x - current.grab.x, y: point.y - current.grab.y });
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = event.shiftKey ? 0.08 : 0.02;
        const moves: Record<string, Point> = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: -step },
            ArrowDown: { x: 0, y: step },
        };
        const move = moves[event.key];
        if (!move) return;
        event.preventDefault();
        onChange({ x: origin.x + move.x, y: origin.y + move.y });
    };

    return (
        <div className="material mx-auto mt-4 w-44 rounded-[0.875rem] p-1 md:absolute md:bottom-6 md:left-1/2 md:mt-0 md:w-56 md:-translate-x-1/2">
            <div
                role="group"
                tabIndex={0}
                aria-label="Zoom position. Use the arrow keys to move the magnified area."
                className="relative cursor-crosshair touch-none overflow-hidden rounded-[0.625rem] outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ aspectRatio: gooseDetail.aspect }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
                onKeyDown={onKeyDown}
            >
                <img src={images.goose.src} alt="" loading="lazy" decoding="async" draggable={false} className="size-full object-cover" />
                <span
                    aria-hidden
                    className={cn(
                        "absolute cursor-grab rounded-[3px] ring-[1.5px] ring-white",
                        "shadow-[0_0_0_999px_rgb(0_0_0/0.38)]",
                    )}
                    style={{
                        left: `${origin.x * 100}%`,
                        top: `${origin.y * 100}%`,
                        width: `${lens.width * 100}%`,
                        height: `${lens.height * 100}%`,
                    }}
                />
            </div>
        </div>
    );
}
