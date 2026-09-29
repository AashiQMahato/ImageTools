import { useState } from "react";
import { formatPageRanges, parsePageRanges } from "./pageRanges";

/**
 * "All pages" or a chosen set — chosen by clicking pages in the grid or typing ranges; the two stay
 * in step. `param` is what the server gets (null: every page).
 */
export function usePageScope(count: number) {
    const [scope, setScope] = useState<"all" | "choose">("all");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [ranges, setRanges] = useState("");
    const choose = (next: Set<string>) => {
        setSelected(next);
        setRanges(formatPageRanges([...next].map(Number)));
    };
    const type = (value: string) => {
        setRanges(value);
        const parsed = parsePageRanges(value, count);
        if (parsed.ok) setSelected(new Set(parsed.pages.map(String)));
    };
    const valid = scope === "all" || (count > 0 && parsePageRanges(ranges, count).ok);
    const includes = (page: number) => scope === "all" || selected.has(String(page));
    return {
        scope,
        setScope,
        selected,
        ranges,
        choose,
        type,
        valid,
        count: scope === "all" ? count : valid ? selected.size : 0,
        includes,
        param: scope === "all" ? null : ranges,
        reset: () => {
            setScope("all");
            setSelected(new Set());
            setRanges("");
        },
        /** Props for the page grid: selectable only when choosing. */
        grid: { selected: scope === "choose" ? selected : null, onSelectedChange: choose, dimmed: (item: { page: number }) => !(scope === "all" || selected.has(String(item.page))) },
    };
}
