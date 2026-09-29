export interface DiffLine {
    text: string;
    changed: boolean;
}

/** Past this many lines each side, lines aren't matched up (the table would be too big); nothing is highlighted. */
const LIMIT = 2000;

/**
 * Before and after, line by line, with the lines that differ marked (longest common subsequence):
 * removed or changed lines on the left, new or changed lines on the right.
 */
export function lineDiff(before: string, after: string): { before: DiffLine[]; after: DiffLine[] } {
    const a = before.split("\n");
    const b = after.split("\n");
    if (a.length > LIMIT || b.length > LIMIT) return { before: a.map((text) => ({ text, changed: false })), after: b.map((text) => ({ text, changed: false })) };
    // lengths[i][j]: common lines between a[i..] and b[j..].
    const lengths = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) lengths[i]![j] = a[i] === b[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
    const keptA = new Set<number>();
    const keptB = new Set<number>();
    for (let i = 0, j = 0; i < a.length && j < b.length; ) {
        if (a[i] === b[j]) {
            keptA.add(i++);
            keptB.add(j++);
        } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) i++;
        else j++;
    }
    return { before: a.map((text, index) => ({ text, changed: !keptA.has(index) })), after: b.map((text, index) => ({ text, changed: !keptB.has(index) })) };
}
