import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Annotation, type NewAnnotation, newId, type Picture, toPayload, type Tool } from "./model";

interface Snapshot {
    items: readonly Annotation[];
    /** Pages to remove when saving (1-based). */
    deleted: readonly number[];
}

export interface ToolStyle {
    color: string;
    textSize: number;
    bold: boolean;
    inkColor: string;
    inkWidth: number;
    markColor: string;
    stroke: string;
    strokeWidth: number;
    fill: string | null;
    opacity: number;
}

const DEFAULT_STYLE: ToolStyle = { color: "#111827", textSize: 14, bold: false, inkColor: "#1d4ed8", inkWidth: 2, markColor: "#facc15", stroke: "#dc2626", strokeWidth: 2, fill: null, opacity: 1 };
const EMPTY: Snapshot = { items: [], deleted: [] };
const HISTORY = 200;

/**
 * The editor's state: the edits and removed pages, with undo and redo (every change is one step —
 * a drag is one step, not hundreds), the tool, its style, what's selected, and the pictures in use.
 */
export function useAnnotator(pageCount: number) {
    const [history, setHistory] = useState<{ past: Snapshot[]; present: Snapshot; future: Snapshot[] }>({ past: [], present: EMPTY, future: [] });
    const { present } = history;
    const [tool, setTool] = useState<Tool>("select");
    const [style, setStyle] = useState<ToolStyle>(DEFAULT_STYLE);
    const [selected, setSelected] = useState<string | null>(null);
    const [editing, setEditing] = useState<string | null>(null);
    /** A change in progress (dragging): shown, not yet in the history. */
    const [draft, setDraftState] = useState<Annotation | null>(null);
    // Also kept in a ref, so a drag can set its last value and commit it in the same moment.
    const draftRef = useRef<Annotation | null>(null);
    const setDraft = useCallback((value: Annotation | null) => {
        draftRef.current = value;
        setDraftState(value);
    }, []);
    const [pictures, setPictures] = useState<ReadonlyMap<string, Picture>>(() => new Map());
    // Blob URLs are freed when the editor goes.
    const everyPicture = useRef(pictures);
    useEffect(() => {
        everyPicture.current = pictures;
    }, [pictures]);
    useEffect(
        () => () => {
            for (const picture of everyPicture.current.values()) URL.revokeObjectURL(picture.url);
        },
        [],
    );

    // Quick repeats of the same change (a slider being dragged) make one step, not dozens.
    const lastChange = useRef({ key: "", time: 0 });
    const commit = useCallback((next: (current: Snapshot) => Snapshot, key = "") => {
        const now = performance.now();
        const merge = key !== "" && lastChange.current.key === key && now - lastChange.current.time < 1000;
        lastChange.current = { key, time: now };
        setHistory((state) => {
            const value = next(state.present);
            if (value === state.present) return state;
            if (merge) return { ...state, present: value, future: [] };
            return { past: [...state.past.slice(-HISTORY + 1), state.present], present: value, future: [] };
        });
        setDraft(null);
    }, [setDraft]);

    const undo = useCallback(() => {
        setHistory((state) => (state.past.length ? { past: state.past.slice(0, -1), present: state.past[state.past.length - 1]!, future: [state.present, ...state.future] } : state));
        setDraft(null);
        setEditing(null);
    }, [setDraft]);
    const redo = useCallback(() => {
        setHistory((state) => (state.future.length ? { past: [...state.past, state.present], present: state.future[0]!, future: state.future.slice(1) } : state));
        setDraft(null);
        setEditing(null);
    }, [setDraft]);

    const add = useCallback(
        (item: NewAnnotation, select = true) => {
            const full = { ...item, id: item.id ?? newId() } as Annotation;
            commit((current) => ({ ...current, items: [...current.items, full] }));
            if (select) setSelected(full.id);
            return full.id;
        },
        [commit],
    );
    /** `key`: names the property being changed, so a run of changes to it is one undo step. */
    const update = useCallback((id: string, change: (item: Annotation) => Annotation, key?: string) => commit((current) => ({ ...current, items: current.items.map((item) => (item.id === id ? change(item) : item)) }), key ? `${id}:${key}` : ""), [commit]);
    const remove = useCallback(
        (id: string) => {
            commit((current) => (current.items.some((item) => item.id === id) ? { ...current, items: current.items.filter((item) => item.id !== id) } : current));
            setSelected((value) => (value === id ? null : value));
            setEditing((value) => (value === id ? null : value));
        },
        [commit],
    );
    /** The change in progress becomes one step in the history (a new edit is added; an existing one replaced). */
    const commitDraft = useCallback(() => {
        const value = draftRef.current;
        if (!value) return;
        commit((current) => (current.items.some((item) => item.id === value.id) ? { ...current, items: current.items.map((item) => (item.id === value.id ? value : item)) } : { ...current, items: [...current.items, value] }));
    }, [commit]);
    /** Drops the change in progress — and the edit itself if it ended up empty (text with no text). */
    const discardDraft = useCallback(
        (id: string) => {
            setDraft(null);
            remove(id);
        },
        [setDraft, remove],
    );

    const togglePage = useCallback(
        (page: number) =>
            commit((current) => {
                if (current.deleted.includes(page)) return { ...current, deleted: current.deleted.filter((value) => value !== page) };
                // A PDF keeps at least one page.
                if (current.deleted.length >= pageCount - 1) return current;
                return { ...current, deleted: [...current.deleted, page].sort((a, b) => a - b) };
            }),
        [commit, pageCount],
    );

    const addPicture = useCallback((picture: Omit<Picture, "url">) => {
        const key = `p-${newId().slice(0, 12)}`;
        const entry = { ...picture, url: URL.createObjectURL(picture.blob) };
        setPictures((current) => new Map(current).set(key, entry));
        return key;
    }, []);

    // The draft stands in for its original while it's being dragged.
    const items = useMemo(() => {
        if (!draft) return present.items;
        return present.items.some((item) => item.id === draft.id) ? present.items.map((item) => (item.id === draft.id ? draft : item)) : [...present.items, draft];
    }, [present.items, draft]);
    const byPage = useMemo(() => {
        const map = new Map<number, Annotation[]>();
        for (const item of items) map.set(item.page, [...(map.get(item.page) ?? []), item]);
        return map;
    }, [items]);

    /** The form the server takes: edits, removed pages, and each picture used, named by its key. */
    const payload = useCallback(() => {
        const used = new Set(present.items.flatMap((item) => (item.kind === "image" ? [item.image] : [])));
        const images = [...used].flatMap((key) => {
            const picture = pictures.get(key);
            return picture ? [{ key, blob: picture.blob }] : [];
        });
        return { annotations: toPayload(present.items), deletePages: present.deleted, images };
    }, [present, pictures]);

    const selectedItem = items.find((item) => item.id === selected) ?? null;
    return {
        items,
        byPage,
        deleted: present.deleted,
        tool,
        setTool: useCallback((next: Tool) => {
            setTool(next);
            setEditing(null);
            if (next !== "select") setSelected(null);
        }, []),
        style,
        setStyle: useCallback((change: Partial<ToolStyle>) => setStyle((current) => ({ ...current, ...change })), []),
        selected: selectedItem,
        select: setSelected,
        editing,
        setEditing,
        draft,
        setDraft,
        commitDraft,
        discardDraft,
        add,
        update,
        remove,
        togglePage,
        undo,
        redo,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        changed: present.items.length > 0 || present.deleted.length > 0,
        pictures,
        addPicture,
        payload,
    };
}

export type Annotator = ReturnType<typeof useAnnotator>;
