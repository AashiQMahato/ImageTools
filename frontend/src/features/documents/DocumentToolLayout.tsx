import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type Notice, PanelBody, PanelIntro, StudioActions, StudioCanvas, StudioDropzone, StudioNotice } from "@/components/studio/StudioParts";
import { BottomSheet } from "@/components/studio/BottomSheet";
import { Button } from "@/components/ui/base/buttons/button";
import type { DocumentToolKey } from "@/lib/constants/navigation";
import { errorMessage, useT } from "@/i18n";
import { DocumentStudio } from "./DocumentStudio";
import { JobProgress, JobResult, PrivacyNote } from "./DocumentStates";
import type { useDocumentJob } from "./useDocumentJob";

interface DocumentToolLayoutProps {
    tool: DocumentToolKey;
    accept: string;
    onFiles: (files: File[]) => void;
    /** No files yet: the drop zone. */
    empty: boolean;
    drop: { title: string; hint: string; limits: string };
    intro: readonly string[];
    job: ReturnType<typeof useDocumentJob>;
    runningTitle: string;
    doneTitle?: string;
    /** Shown above the result's file list (e.g. a preview). */
    result?: ReactNode;
    /** Replaces the standard result (file list) entirely — for results you work with, like extracted text. */
    resultView?: ReactNode;
    onStartOver: () => void;
    /** The tool's settings (right panel). */
    options?: ReactNode;
    /** Above the workspace (e.g. page actions). */
    toolbar?: ReactNode;
    action: { label: string; icon: LucideIcon; onPress: () => void; disabled?: boolean };
    /** Buttons beside the main action (e.g. Add more). */
    secondary?: ReactNode;
    notice?: Notice | null;
    /** The workspace: files or pages. */
    children: ReactNode;
    /** Phones and tablets: the options open as a sheet (the tool's own button opens it) instead of stacking under the page. */
    sheet?: { open: boolean; onClose: () => void; title: string };
}

/**
 * The frame every document tool shares: drop zone → workspace with options → progress → result,
 * with failures reported in words (never raw server errors) and the work kept for another try.
 */
export function DocumentToolLayout({ tool, accept, onFiles, empty, drop, intro, job, runningTitle, doneTitle, result, resultView, onStartOver, options, toolbar, action, secondary, notice, children, sheet }: DocumentToolLayoutProps) {
    const t = useT();
    const running = job.phase === "uploading" || job.phase === "processing" || job.phase === "finalizing";
    const done = job.phase === "completed" && job.job;
    const failure: Notice | null = job.phase === "failed" ? { tone: "error", text: errorMessage(t, job.error) } : null;
    const shown = failure ?? notice ?? null;

    return (
        <DocumentStudio
            tool={tool}
            accept={accept}
            onFiles={onFiles}
            dirty={!empty && !done}
            mobilePanel={sheet && !empty && !running && !done ? "none" : "stack"}
            panelLabel={t.nav.toolItems[tool].title}
            panel={
                <PanelBody>
                    {empty ? <PanelIntro title={t.studio.howItWorks} steps={intro} /> : options}
                    <PrivacyNote />
                </PanelBody>
            }
        >
            {!empty && !running && !done && toolbar}
            <StudioCanvas>
                {empty ? (
                    <StudioDropzone title={drop.title} hint={drop.hint} limits={drop.limits} />
                ) : running ? (
                    <div className="flex flex-1 items-center justify-center overflow-y-auto">
                        <JobProgress state={job} title={runningTitle} onCancel={job.cancel} />
                    </div>
                ) : done ? (
                    <div className="min-h-0 flex-1 overflow-y-auto px-3 sm:px-6">
                        {resultView ?? (
                            <JobResult job={job.job!} title={doneTitle} tool={tool} onStartOver={onStartOver}>
                                {result}
                            </JobResult>
                        )}
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">{children}</div>
                )}
            </StudioCanvas>
            {shown && !running && <StudioNotice notice={shown} />}
            {sheet && (
                <BottomSheet open={sheet.open && !empty && !running && !done} onClose={sheet.onClose} title={sheet.title} closeLabel={t.documents.done}>
                    {options}
                </BottomSheet>
            )}
            {!empty && !running && !done && (
                <StudioActions>
                    {secondary}
                    <Button size="lg" color="primary" iconLeading={action.icon} onPress={action.onPress} isDisabled={action.disabled} className="press-scale pointer-coarse:min-h-12">
                        {action.label}
                    </Button>
                </StudioActions>
            )}
        </DocumentStudio>
    );
}
