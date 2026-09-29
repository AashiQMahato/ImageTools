import type { Tool } from "./model";

export const MARKUP: readonly Tool[] = ["highlight", "underline", "strike"];
export const EDIT_TOOLS: readonly Tool[] = ["select", "text", "draw", "highlight", "underline", "strike", "rect", "ellipse", "line", "arrow", "image", "signature"];
export const SIGN_TOOLS: readonly Tool[] = ["select", "signature", "text", "date"];
/** Single-key shortcuts for the tools (when not typing). */
export const TOOL_KEYS: Partial<Record<string, Tool>> = { v: "select", t: "text", d: "draw", h: "highlight", u: "underline", k: "strike", r: "rect", o: "ellipse", l: "line", a: "arrow", s: "signature" };

export const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
