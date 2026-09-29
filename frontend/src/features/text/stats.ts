export interface TextStats {
    characters: number;
    charactersNoSpaces: number;
    words: number;
    sentences: number;
    paragraphs: number;
    lines: number;
    /** Minutes, from words per minute by script. */
    readingMinutes: number;
}

/** Typical silent reading speeds (words per minute): English prose, and Devanagari text. */
const WPM = { latin: 238, devanagari: 180 };
const DEVANAGARI = /[ऀ-ॿ]/;

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });
const sentenceSegmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });

/**
 * Counts for any language: characters are what a reader sees (a Devanagari letter with its vowel
 * signs is one), words and sentences use Unicode's rules (the danda ends a sentence).
 */
export function textStats(text: string): TextStats {
    let characters = 0;
    let charactersNoSpaces = 0;
    for (const { segment } of graphemes.segment(text)) {
        if (segment === "\n" || segment === "\r\n") continue;
        characters++;
        if (!/^\s+$/u.test(segment)) charactersNoSpaces++;
    }
    let latin = 0;
    let devanagari = 0;
    for (const { segment, isWordLike } of wordSegmenter.segment(text)) {
        if (!isWordLike) continue;
        if (DEVANAGARI.test(segment)) devanagari++;
        else latin++;
    }
    const sentences = [...sentenceSegmenter.segment(text)].filter(({ segment }) => /[\p{L}\p{N}]/u.test(segment)).length;
    const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim()).length;
    const lines = text.split("\n").filter((line) => line.trim()).length;
    return { characters, charactersNoSpaces, words: latin + devanagari, sentences, paragraphs, lines, readingMinutes: latin / WPM.latin + devanagari / WPM.devanagari };
}
