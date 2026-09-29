import { useEffect, useRef } from "react";
import { moved } from "./model";
import type { AnnotatorMode } from "./PdfAnnotator";
import { EDIT_TOOLS, isTyping, SIGN_TOOLS, TOOL_KEYS } from "./tools";
import type { Annotator } from "./useAnnotator";

/** Undo / redo, delete, nudge, Escape and the tool keys — while the editor is open. */
export function useAnnotatorKeys(annotator: Annotator, mode: AnnotatorMode, actions: { onSignature: () => void; zoomIn: () => void; zoomOut: () => void }) {
    const latest = useRef({ annotator, mode, actions });
    useEffect(() => {
        latest.current = { annotator, mode, actions };
    });
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const { annotator: state, mode: current, actions: handlers } = latest.current;
            const command = event.metaKey || event.ctrlKey;
            if (window.document.querySelector("dialog[open]")) return;
            if (command && (event.key === "=" || event.key === "+")) {
                event.preventDefault();
                return handlers.zoomIn();
            }
            if (command && event.key === "-") {
                event.preventDefault();
                return handlers.zoomOut();
            }
            if (isTyping(event.target)) return;
            if (command && event.key.toLowerCase() === "z") {
                event.preventDefault();
                return event.shiftKey ? state.redo() : state.undo();
            }
            if (command && event.key.toLowerCase() === "y") {
                event.preventDefault();
                return state.redo();
            }
            if (command || event.altKey) return;
            const selected = state.selected;
            if (selected && (event.key === "Delete" || event.key === "Backspace")) {
                event.preventDefault();
                return state.remove(selected.id);
            }
            if (selected && event.key === "Enter" && selected.kind === "text") {
                event.preventDefault();
                return state.setEditing(selected.id);
            }
            if (event.key === "Escape") {
                if (selected) state.select(null);
                else state.setTool("select");
                return;
            }
            const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
            if (selected && nudge) {
                event.preventDefault();
                const step = event.shiftKey ? 10 : 1;
                return state.update(selected.id, (item) => moved(item, nudge[0]! * step, nudge[1]! * step), "nudge");
            }
            const tool = TOOL_KEYS[event.key.toLowerCase()];
            const allowed = current === "sign" ? SIGN_TOOLS : EDIT_TOOLS;
            if (tool && allowed.includes(tool) && !event.shiftKey) {
                event.preventDefault();
                if (tool === "signature") handlers.onSignature();
                else state.setTool(tool);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}
