import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/apiClient";
import { deleteJob, getJob, type Job, startJob } from "@/lib/api/jobsApi";
import type { AppErrorInfo } from "@/i18n";

export type JobPhase = "idle" | "uploading" | "processing" | "finalizing" | "completed" | "failed";

export interface DocumentJobState {
    phase: JobPhase;
    /** Upload progress, 0–1 (real, from the browser). */
    upload: number;
    job: Job | null;
    error: AppErrorInfo | null;
}

const IDLE: DocumentJobState = { phase: "idle", upload: 0, job: null, error: null };
/** Steps the server reports at the end of a job. */
const FINAL_STEPS = new Set(["saving", "finishing"]);

/**
 * One document operation, start to finish: the upload (with real progress), then the server's job,
 * followed until it completes or fails. Leaving, starting over or cancelling deletes the job — and its
 * files — on the server straight away.
 */
export function useDocumentJob() {
    const [state, setState] = useState<DocumentJobState>(IDLE);
    const controller = useRef<AbortController | null>(null);
    const jobId = useRef<string | null>(null);

    const stop = useCallback(() => {
        controller.current?.abort();
        controller.current = null;
        if (jobId.current) deleteJob(jobId.current);
        jobId.current = null;
    }, []);
    useEffect(() => stop, [stop]);

    const run = useCallback(
        async (path: string, form: FormData) => {
            stop();
            const current = new AbortController();
            controller.current = current;
            setState({ ...IDLE, phase: "uploading" });
            try {
                let job = await startJob(path, form, { signal: current.signal, onUploadProgress: (upload) => setState((previous) => ({ ...previous, upload })) });
                jobId.current = job.id;
                setState((previous) => ({ ...previous, phase: "processing", upload: 1, job }));
                // Follow the job: quickly at first, then a little less often for long ones.
                let delay = 250;
                while (job.status === "queued" || job.status === "processing") {
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    if (current.signal.aborted) return null;
                    job = await getJob(job.id, current.signal);
                    delay = Math.min(1000, delay + 100);
                    const snapshot = job;
                    setState((previous) => ({ ...previous, job: snapshot, phase: FINAL_STEPS.has(snapshot.progress.step) ? "finalizing" : "processing" }));
                }
                if (job.status === "failed") {
                    setState((previous) => ({ ...previous, phase: "failed", job, error: job.error ?? { code: "PROCESSING_FAILED" } }));
                    jobId.current = null;
                    return null;
                }
                setState((previous) => ({ ...previous, phase: "completed", job }));
                return job;
            } catch (error) {
                if (current.signal.aborted) return null;
                setState((previous) => ({ ...previous, phase: "failed", error: error instanceof ApiError ? { code: error.code, message: error.message } : { code: "GENERIC" } }));
                return null;
            }
        },
        [stop],
    );

    const cancel = useCallback(() => {
        stop();
        setState(IDLE);
    }, [stop]);

    return { ...state, run, cancel, reset: cancel };
}
