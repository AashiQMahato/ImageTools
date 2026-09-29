import type { Placement } from "./imageLayout";

/**
 * A PDF page as it will come out: the paper at its real proportions, the image in its box — turned,
 * and trimmed when it fills the area ("cover"). Drawn with CSS from the same numbers as the server.
 */
export function PagePreview({ src, alt, placement, rotate, frameAspect = 3 / 4 }: { src: string; alt: string; placement: Placement; rotate: number; frameAspect?: number }) {
    const { page, box, crop } = placement;
    const aspect = page.width / page.height;
    const pct = (value: number, of: number) => `${(value / of) * 100}%`;
    const sideways = rotate % 180 !== 0;
    return (
        <span className="grid size-full place-items-center p-2">
            <span className="relative block max-h-full max-w-full bg-white shadow-[0_1px_4px_rgb(0_0_0/0.2)]" style={{ aspectRatio: `${aspect}`, [aspect < frameAspect ? "height" : "width"]: "100%" }}>
                <span className="absolute overflow-hidden" style={{ left: pct(box.x, page.width), top: pct(box.y, page.height), width: pct(box.width, page.width), height: pct(box.height, page.height) }}>
                    <img
                        src={src}
                        alt={alt}
                        draggable={false}
                        className="absolute top-1/2 left-1/2 max-w-none"
                        style={{
                            // Turned a quarter, the image's width runs along the box's height.
                            width: sideways ? pct(box.height, box.width) : "100%",
                            height: sideways ? pct(box.width, box.height) : "100%",
                            objectFit: crop ? "cover" : "fill",
                            transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
                        }}
                    />
                </span>
            </span>
        </span>
    );
}
