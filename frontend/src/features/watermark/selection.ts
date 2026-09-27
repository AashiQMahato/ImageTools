import type { SelectionStroke } from "@/features/retouch/useSelectionMask";
import type { WatermarkDetection } from "@/lib/api/watermarkApi";

/** Detections at or above this start selected; the rest are offered, unticked. */
export const PRESELECT = 0.6;

const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * A detected region as part of the selection: its outline, grown by a fraction of the text's line
 * height (its short side) so anti-aliased letter edges are covered too.
 */
export function detectionStroke({ polygon }: WatermarkDetection): SelectionStroke {
    const [a, b, c] = polygon;
    const lineHeight = a && b && c ? Math.min(distance(a, b), distance(b, c)) : 20;
    return { mode: "paint", shape: "polygon", size: Math.max(4, lineHeight * 0.18), softness: 0.3, opacity: 1, points: polygon.flat() };
}
