import { AppError } from "../../utils/AppError.js";

export interface PageRange {
    /** 1-based, inclusive. */
    start: number;
    end: number;
}

const invalid = (message: string) => new AppError(message, 400, "INVALID_PAGES");

/**
 * "1-3, 5, 7-10" (and "8-" for "8 to the end") → ranges, checked against the page count. Anything
 * else is refused with a message that says what's wrong.
 */
export function parsePageRanges(input: string, pageCount: number): PageRange[] {
    const parts = input
        .split(/[,;]/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) throw invalid("Enter the pages, for example 1-3, 5, 7-10.");
    if (parts.length > 500) throw invalid("That's too many ranges.");
    return parts.map((part) => {
        const match = /^(\d{1,5})\s*(?:[-–]\s*(\d{1,5})?)?$/.exec(part);
        if (!match) throw invalid(`"${part.slice(0, 20)}" isn't a page or a range. Use numbers like 1-3 or 5.`);
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : part.includes("-") || part.includes("–") ? pageCount : start;
        if (start < 1 || end < 1) throw invalid("Pages start at 1.");
        if (start > end) throw invalid(`${start}-${end} runs backwards. Write the smaller page first.`);
        if (end > pageCount) throw invalid(pageCount === 1 ? "This document has only 1 page." : `This document has ${pageCount} pages; page ${end} doesn't exist.`);
        return { start, end };
    });
}

/** Every page the ranges cover, in order, without repeats. */
export function pagesIn(ranges: PageRange[]): number[] {
    const pages = new Set<number>();
    for (const { start, end } of ranges) for (let page = start; page <= end; page++) pages.add(page);
    return [...pages].sort((a, b) => a - b);
}
