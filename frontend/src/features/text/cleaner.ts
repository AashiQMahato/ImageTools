import type { JSONContent } from "@tiptap/core";

/**
 * Text cleaning that works on the document itself, not a flattened copy: formatting, links, lists
 * and tables survive. Code (blocks and inline code) is never touched, and Devanagari's joiners
 * (ZWJ/ZWNJ), which change how letters combine, are kept.
 */
export type CleanRule = "extraSpaces" | "duplicateLines" | "joinLines" | "blankParagraphs" | "collapseBlankLines" | "ocrSpacing" | "punctuation" | "specialCharacters";

export const CLEAN_RULES: readonly CleanRule[] = ["extraSpaces", "ocrSpacing", "joinLines", "blankParagraphs", "collapseBlankLines", "duplicateLines", "punctuation", "specialCharacters"];

export type CleanCounts = Record<CleanRule, number>;

const INLINE: Record<Exclude<CleanRule, "duplicateLines" | "joinLines" | "blankParagraphs" | "collapseBlankLines">, [RegExp, string][]> = {
    // Control characters, zero-width spaces, soft hyphens, byte-order marks, replacement and
    // private-use characters (stray symbols from PDFs and OCR). Not ZWJ/ZWNJ: Devanagari needs them.
    // eslint-disable-next-line no-control-regex -- removing stray control characters is this rule's job
    specialCharacters: [[/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­​⁠﻿�-]/g, ""]],
    punctuation: [
        [/[“”„‟″]/g, '"'],
        [/[‘’‚‛′]/g, "'"],
        [/([!?])\1+/g, "$1"],
        [/,{2,}/g, ","],
        [/\.{4,}/g, "..."],
    ],
    ocrSpacing: [
        // No space before closing punctuation (including the danda), or after an opening bracket.
        [/[ \t]+([,.;:!?।॥)\]}])/g, "$1"],
        [/([([{])[ \t]+/g, "$1"],
        // A space after a comma, semicolon, danda, !, ? before a letter ("one,two" → "one, two").
        [/([,;!?।॥])(?=\p{L})/gu, "$1 "],
        // "end.Next" → "end. Next" — only between lowercase and uppercase letters, so "e.g." and URLs stay.
        [/(\p{Ll}{2})\.(?=\p{Lu})/gu, "$1. "],
    ],
    extraSpaces: [[/[ \t  -   　]{2,}/g, " "]],
};

type Node = JSONContent;
const isCode = (node: Node) => node.marks?.some((mark) => mark.type === "code") ?? false;
const isBreak = (node: Node) => node.type === "hardBreak";
const textOf = (block: Node) => (block.content ?? []).map((child) => (child.type === "text" ? (child.text ?? "") : isBreak(child) ? "\n" : "")).join("");

function cleanInline(content: Node[], rules: ReadonlySet<CleanRule>, counts: CleanCounts): Node[] {
    let nodes = content.map((node) => {
        if (node.type !== "text" || isCode(node) || !node.text) return node;
        let text = node.text;
        for (const rule of ["specialCharacters", "punctuation", "ocrSpacing", "extraSpaces"] as const) {
            if (!rules.has(rule)) continue;
            for (const [pattern, replacement] of INLINE[rule]) {
                const found = text.match(pattern)?.length ?? 0;
                if (!found) continue;
                counts[rule] += found;
                text = text.replace(pattern, replacement);
            }
        }
        return { ...node, text };
    });

    if (rules.has("joinLines")) {
        // A line break in the middle of a sentence (as OCR and copied PDFs leave them) becomes a space;
        // a word hyphenated across the break is put back together.
        const joined: Node[] = [];
        nodes.forEach((node, index) => {
            const previous = joined.at(-1);
            const next = nodes[index + 1];
            if (isBreak(node) && previous?.type === "text" && next?.type === "text" && !isCode(previous) && !isCode(next)) {
                const before = previous.text ?? "";
                const after = next.text ?? "";
                const endsSentence = /[.!?।॥:;"')\]]\s*$/.test(before) || !before.trim();
                const continues = /^\s*[\p{Ll}ऀ-ॿ\d]/u.test(after);
                if (!endsSentence && continues) {
                    counts.joinLines++;
                    if (/\p{L}-$/u.test(before)) joined[joined.length - 1] = { ...previous, text: before.slice(0, -1) };
                    else joined.push({ type: "text", text: " ", ...(previous.marks ? { marks: previous.marks } : {}) });
                    return;
                }
            }
            joined.push(node);
        });
        nodes = joined;
    }

    if (rules.has("blankParagraphs") || rules.has("collapseBlankLines")) {
        // Blank lines inside a paragraph: all of them go, or runs of them become one.
        const limit = rules.has("blankParagraphs") ? 1 : 2;
        const kept: Node[] = [];
        let run = 0;
        for (const node of nodes) {
            run = isBreak(node) ? run + 1 : node.type === "text" && !(node.text ?? "").trim() ? run : 0;
            if (isBreak(node) && run > limit) {
                counts[rules.has("blankParagraphs") ? "blankParagraphs" : "collapseBlankLines"]++;
                continue;
            }
            kept.push(node);
        }
        nodes = kept;
    }

    if (rules.has("duplicateLines")) {
        // The same line twice in a row (within one paragraph): the repeat goes.
        const lines: Node[][] = [[]];
        for (const node of nodes) {
            if (isBreak(node)) lines.push([]);
            else lines.at(-1)!.push(node);
        }
        const kept: Node[][] = [];
        for (const line of lines) {
            const text = line.map((node) => node.text ?? "").join("").trim();
            const previous = kept.at(-1);
            if (text && previous && previous.map((node) => node.text ?? "").join("").trim() === text) {
                counts.duplicateLines++;
                continue;
            }
            kept.push(line);
        }
        nodes = kept.flatMap((line, index) => (index ? [{ type: "hardBreak" }, ...line] : line));
    }

    if (rules.has("extraSpaces") || rules.has("ocrSpacing")) {
        // Spaces where text nodes meet, and at the ends of lines.
        for (let index = 0; index < nodes.length; index++) {
            const node = nodes[index]!;
            if (node.type !== "text" || isCode(node)) continue;
            const previous = nodes[index - 1];
            const next = nodes[index + 1];
            let text = node.text ?? "";
            if ((!previous || isBreak(previous) || (previous.type === "text" && /\s$/.test(previous.text ?? ""))) && /^\s/.test(text)) text = text.replace(/^\s+/, "");
            if ((!next || isBreak(next)) && /\s$/.test(text)) text = text.replace(/\s+$/, "");
            if (text !== node.text) counts.extraSpaces++;
            nodes[index] = { ...node, text };
        }
    }
    return nodes.filter((node) => node.type !== "text" || node.text);
}

const TEXTBLOCKS = new Set(["paragraph", "heading"]);

function cleanBlocks(blocks: Node[], rules: ReadonlySet<CleanRule>, counts: CleanCounts, top: boolean): Node[] {
    const seen = new Set<string>();
    const result: Node[] = [];
    let blankRun = 0;
    for (const block of blocks) {
        if (block.type === "codeBlock") {
            result.push(block);
            blankRun = 0;
            continue;
        }
        if (TEXTBLOCKS.has(block.type ?? "")) {
            const cleaned: Node = { ...block, content: cleanInline(block.content ?? [], rules, counts) };
            if (!cleaned.content!.length) delete cleaned.content;
            const text = textOf(cleaned).trim();
            if (!text) {
                blankRun++;
                if (top && rules.has("blankParagraphs")) {
                    counts.blankParagraphs++;
                    continue;
                }
                if (top && rules.has("collapseBlankLines") && blankRun > 1) {
                    counts.collapseBlankLines++;
                    continue;
                }
            } else {
                blankRun = 0;
                if (top && rules.has("duplicateLines")) {
                    const key = `${block.type}:${text}`;
                    if (seen.has(key)) {
                        counts.duplicateLines++;
                        continue;
                    }
                    seen.add(key);
                }
            }
            result.push(cleaned);
            continue;
        }
        blankRun = 0;
        // Lists, tables, quotes: clean what's inside, keep the structure.
        result.push(block.content ? { ...block, content: cleanBlocks(block.content, rules, counts, false) } : block);
    }
    return result;
}

/** A cleaned copy of the document (the original isn't changed), and how many fixes each rule made. */
export function cleanDocument(doc: JSONContent, rules: ReadonlySet<CleanRule>): { doc: JSONContent; counts: CleanCounts } {
    const counts = Object.fromEntries(CLEAN_RULES.map((rule) => [rule, 0])) as CleanCounts;
    const content = cleanBlocks(doc.content ?? [], rules, counts, true);
    return { doc: { ...doc, content: content.length ? content : [{ type: "paragraph" }] }, counts };
}
