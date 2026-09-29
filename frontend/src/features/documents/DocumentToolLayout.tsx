import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type Notice, PanelBody, PanelIntro, StudioActions, StudioCanvas, StudioDropzone, StudioNotice } from "@/components/studio/StudioParts";
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
}

/**
 * The frame every document tool shares: drop zone → workspace with options → progress → result,
 * with failures reported in words (never raw server errors) and the work kept for another try.
 */
export function DocumentToolLayout({ tool, accept, onFiles, empty, drop, intro, job, runningTitle, doneTitle, result, onStartOver, options, toolbar, action, secondary, notice, children }: DocumentToolLayoutProps) {
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
                        <JobResult job={job.job!} title={doneTitle} onStartOver={onStartOver}>
                            {result}
                        </JobResult>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">{children}</div>
                )}
            </StudioCanvas>
            {shown && !running && <StudioNotice notice={shown} />}
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
