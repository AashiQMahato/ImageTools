import { TextWorkspace } from "@/features/text/TextWorkspace";

/**
 * One Text Editor. Cleaning, case conversion and word counts are its panels; their old addresses
 * still work and open the editor on that panel.
 */
export const TextEditorPage = () => <TextWorkspace tool="textEditor" tab="stats" />;
export const TextCleanerPage = () => <TextWorkspace tool="textEditor" tab="clean" />;
export const CaseConverterPage = () => <TextWorkspace tool="textEditor" tab="case" />;
export const WordCounterPage = () => <TextWorkspace tool="textEditor" tab="stats" />;
