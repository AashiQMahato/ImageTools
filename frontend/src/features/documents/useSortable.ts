import { type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useLayoutEffect, useRef, useState } from "react";

interface Drag {
    id: string;
    /** Where in the item it was grabbed, so it stays under the pointer exactly there. */
    offset: { x: number; y: number };
    size: { width: number; height: number };
    /** Where the dragged copy starts (top left, viewport pixels). */
    at: { x: number; y: number };
}

const THRESHOLD = 6;
const EDGE = 64;

function scrollParent(element: HTMLElement | null): HTMLElement | null {
    for (let node = element?.parentElement ?? null; node; node = node.parentElement) {
        const { overflowY } = getComputedStyle(node);
        if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    }
    return null;
}

/**
 * Drag to reorder, for lists and grids. A mouse drags the whole item; touch drags by its handle
 * (`data-drag-handle`), so the page still scrolls. Buttons inside items (`data-no-drag`) stay
 * buttons. Alt+arrow keys move the focused item. Items glide to their new places (FLIP).
 */
export function useSortable<T>({ items, getId, onReorder, disabled = false }: { items: readonly T[]; getId: (item: T) => string; onReorder: (items: T[]) => void; disabled?: boolean }) {
    const container = useRef<HTMLElement | null>(null);
    const ghost = useRef<HTMLDivElement | null>(null);
    const [drag, setDrag] = useState<Drag | null>(null);
    const latest = useRef({ items, onReorder });
    useLayoutEffect(() => {
        latest.current = { items, onReorder };
    }, [items, onReorder]);

    // FLIP: remember where every item was, and after a reorder slide each from there to its new place.
    const positions = useRef(new Map<string, DOMRect>());
    const elements = () => [...(container.current?.querySelectorAll<HTMLElement>("[data-sort-id]") ?? [])];
    useLayoutEffect(() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const next = new Map<string, DOMRect>();
        for (const element of elements()) {
            const id = element.dataset.sortId!;
            const rect = element.getBoundingClientRect();
            next.set(id, rect);
            const before = positions.current.get(id);
            if (!before || reduced || id === drag?.id) continue;
            const dx = before.left - rect.left;
            const dy = before.top - rect.top;
            if (!dx && !dy) continue;
            element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 220, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
        }
        positions.current = next;
    }, [items, drag?.id]);

    const move = useCallback(
        (id: string, to: number) => {
            const list = [...latest.current.items];
            const from = list.findIndex((item) => getId(item) === id);
            if (from < 0 || to === from || to < 0 || to >= list.length) return false;
            const [moved] = list.splice(from, 1);
            list.splice(to, 0, moved!);
            latest.current.onReorder(list);
            return true;
        },
        [getId],
    );

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLElement>, id: string) => {
            if (disabled || event.button !== 0) return;
            const target = event.target as HTMLElement;
            if (target.closest("[data-no-drag], button, input, select, a, label")) return;
            if (event.pointerType !== "mouse" && !target.closest("[data-drag-handle]")) return;
            const element = event.currentTarget;
            const start = { x: event.clientX, y: event.clientY };
            const rect = element.getBoundingClientRect();
            let active = false;
            let frame = 0;
            let pointer = start;

            const autoscroll = () => {
                const parent = scrollParent(element);
                if (parent && active) {
                    const bounds = parent.getBoundingClientRect();
                    if (pointer.y < bounds.top + EDGE) parent.scrollBy(0, -12);
                    else if (pointer.y > bounds.bottom - EDGE) parent.scrollBy(0, 12);
                }
                frame = requestAnimationFrame(autoscroll);
            };

            const onMove = (move_: PointerEvent) => {
                pointer = { x: move_.clientX, y: move_.clientY };
                if (!active) {
                    if (Math.hypot(pointer.x - start.x, pointer.y - start.y) < THRESHOLD) return;
                    active = true;
                    setDrag({ id, offset: { x: start.x - rect.left, y: start.y - rect.top }, size: { width: rect.width, height: rect.height }, at: { x: pointer.x - (start.x - rect.left), y: pointer.y - (start.y - rect.top) } });
                    frame = requestAnimationFrame(autoscroll);
                }
                move_.preventDefault();
                if (ghost.current) ghost.current.style.transform = `translate(${pointer.x - (start.x - rect.left)}px, ${pointer.y - (start.y - rect.top)}px)`;
                // The item under the pointer is where this one goes.
                const over = elements().find((candidate) => {
                    const box = candidate.getBoundingClientRect();
                    return pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom;
                });
                const overId = over?.dataset.sortId;
                if (overId && overId !== id) move(id, latest.current.items.findIndex((item) => getId(item) === overId));
            };
            const onUp = () => {
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
                window.removeEventListener("pointercancel", onUp);
                cancelAnimationFrame(frame);
                if (active) {
                    setDrag(null);
                    // A drag isn't also a click (on whatever it was dropped over).
                    const swallow = (click: MouseEvent) => {
                        click.stopPropagation();
                        click.preventDefault();
                    };
                    window.addEventListener("click", swallow, { capture: true, once: true });
                    setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
                }
            };
            window.addEventListener("pointermove", onMove, { passive: false });
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
        },
        [disabled, getId, move],
    );

    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>, id: string) => {
            if (disabled || !event.altKey) return;
            const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : 0;
            if (!step) return;
            event.preventDefault();
            const index = latest.current.items.findIndex((item) => getId(item) === id);
            if (move(id, index + step)) requestAnimationFrame(() => container.current?.querySelector<HTMLElement>(`[data-sort-id="${CSS.escape(id)}"]`)?.focus());
        },
        [disabled, getId, move],
    );

    /** Props for each item. */
    const itemProps = (id: string) => ({
        "data-sort-id": id,
        onPointerDown: (event: ReactPointerEvent<HTMLElement>) => onPointerDown(event, id),
        onKeyDown: (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, id),
        "data-dragging": drag?.id === id || undefined,
    });

    /** For the dragged copy: placed once when it appears; after that it follows the pointer directly (no re-renders). */
    const attachGhost = useCallback(
        (element: HTMLDivElement | null) => {
            ghost.current = element;
            if (element && drag && !element.style.transform) element.style.transform = `translate(${drag.at.x}px, ${drag.at.y}px)`;
        },
        [drag],
    );

    const attachContainer = useCallback((element: HTMLElement | null) => {
        container.current = element;
    }, []);

    return { attachContainer, attachGhost, drag, itemProps, move };
}
