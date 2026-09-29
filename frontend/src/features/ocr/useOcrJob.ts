import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError } from "@/lib/api/apiClient";
import { extractText, type OcrDocument, type OcrLanguage, type OcrRegion, type OcrStage, type StageEvent } from "@/lib/api/ocrApi";
import type { AppErrorInfo } from "@/i18n";

/** Uploading is ours to see; everything after is reported by the server as it happens. */
export type JobStage = "upload" | OcrStage;
export const STAGES: readonly JobStage[] = ["upload", "prepare", "read", "layout", "paragraphs", "formatting", "document"];

export interface StageState {
    status: "pending" | "active" | "done";
    detail?: Record<string, unknown>;
}

interface State {
    status: "idle" | "running" | "done" | "error" | "cancelled";
    stages: Record<JobStage, StageState>;
    result: OcrDocument | null;
    error: AppErrorInfo | null;
    startedAt: number | null;
}

const pending = () => Object.fromEntries(STAGES.map((stage) => [stage, { status: "pending" }])) as Record<JobStage, StageState>;
const initial: State = { status: "idle", stages: pending(), result: null, error: null, startedAt: null };

type Action = { type: "start" } | { type: "event"; event: StageEvent } | { type: "done"; result: OcrDocument } | { type: "fail"; error: AppErrorInfo } | { type: "cancel" } | { type: "reset" };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "start":
            return { ...initial, stages: { ...pending(), upload: { status: "active" } }, status: "running", startedAt: Date.now() };
        case "event": {
            const { event } = action;
            // The server's first word means the upload has arrived.
            const stages = { ...state.stages, upload: { status: "done" as const } };
            stages[event.stage] = { status: event.status, detail: { ...state.stages[event.stage].detail, ...event.detail } };
            return { ...state, stages };
        }
        case "done":
            return { ...state, status: "done", result: action.result };
        case "fail":
            return { ...state, status: "error", error: action.error };
        case "cancel":
            return { ...initial, status: "cancelled" };
        case "reset":
            return initial;
    }
}

/** One reading of an image: its stages as the server reports them, then the document (or why not). */
export function useOcrJob() {
    const [state, dispatch] = useReducer(reducer, initial);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);

    const run = useCallback(async (image: Blob, fileName: string, options: { language: OcrLanguage; region: OcrRegion | null; preserveLayout: boolean }) => {
        controller.current?.abort();
        const current = new AbortController();
        controller.current = current;
        dispatch({ type: "start" });
        try {
            const result = await extractText(image, fileName, options, (event) => dispatch({ type: "event", event }), current.signal);
            if (current.signal.aborted) return null;
            dispatch({ type: "done", result });
            return result;
        } catch (error) {
            if (current.signal.aborted) return null;
            dispatch({ type: "fail", error: error instanceof ApiError ? { code: error.code, message: error.message } : { code: "GENERIC" } });
            return null;
        }
    }, []);

    const cancel = useCallback(() => {
        controller.current?.abort();
        dispatch({ type: "cancel" });
    }, []);
    const reset = useCallback(() => {
        controller.current?.abort();
        dispatch({ type: "reset" });
    }, []);

    return { ...state, run, cancel, reset };
}
