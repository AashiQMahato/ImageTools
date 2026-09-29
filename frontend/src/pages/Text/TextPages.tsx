import { TextWorkspace } from "@/features/text/TextWorkspace";

/** The text tools share one workspace (and one document); each opens it on its own panel. */
export const TextEditorPage = () => <TextWorkspace tool="textEditor" tab="stats" />;
export const TextCleanerPage = () => <TextWorkspace tool="textCleaner" tab="clean" />;
export const CaseConverterPage = () => <TextWorkspace tool="caseConverter" tab="case" />;
export const WordCounterPage = () => <TextWorkspace tool="wordCounter" tab="stats" />;
