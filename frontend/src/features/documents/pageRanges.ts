import type { Dictionary } from "@/i18n";

/** 1-based, inclusive. */
export interface PageRange {
    start: number;
    end: number;
}

export type RangeProblem = { kind: "empty" } | { kind: "syntax"; part: string } | { kind: "backwards"; start: number; end: number } | { kind: "outside"; page: number; count: number };

/**
 * "1-3, 5, 7-10" (and "8-" for "8 to the end") → ranges — the same rules the server applies, so a
 * range that passes here won't be refused there.
 */
export function parsePageRanges(input: string, count: number): { ok: true; ranges: PageRange[]; pages: number[] } | { ok: false; problem: RangeProblem } {
    const parts = input
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return { ok: false, problem: { kind: "empty" } };
    const ranges: PageRange[] = [];
    for (const part of parts) {
        const match = /^(\d{1,5})\s*(?:[-–]\s*(\d{1,5})?)?$/.exec(part);
        if (!match) return { ok: false, problem: { kind: "syntax", part: part.slice(0, 20) } };
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : /[-–]/.test(part) ? count : start;
        if (start < 1 || end < 1) return { ok: false, problem: { kind: "syntax", part } };
        if (start > end) return { ok: false, problem: { kind: "backwards", start, end } };
        if (end > count) return { ok: false, problem: { kind: "outside", page: end, count } };
        ranges.push({ start, end });
    }
    const pages = [...new Set(ranges.flatMap(({ start, end }) => Array.from({ length: end - start + 1 }, (_, index) => start + index)))].sort((a, b) => a - b);
    return { ok: true, ranges, pages };
}

/** Pages → the shortest range text: [1,2,3,5,7,8] → "1-3, 5, 7-8". */
export function formatPageRanges(pages: readonly number[]): string {
    const sorted = [...new Set(pages)].sort((a, b) => a - b);
    const parts: string[] = [];
    for (let index = 0; index < sorted.length; ) {
        let end = index;
        while (end + 1 < sorted.length && sorted[end + 1] === sorted[end]! + 1) end++;
        parts.push(end === index ? String(sorted[index]) : `${sorted[index]}-${sorted[end]}`);
        index = end + 1;
    }
    return parts.join(", ");
}

/** What's wrong with typed ranges, in words. */
export function rangeMessage(t: Dictionary, problem: RangeProblem) {
    const copy = t.documents.ranges;
    switch (problem.kind) {
        case "empty":
            return copy.empty;
        case "syntax":
            return copy.syntax(problem.part);
        case "backwards":
            return copy.backwards(problem.start, problem.end);
        case "outside":
            return copy.outside(problem.page, problem.count);
    }
}
