/** A name any file system takes: no path separators or reserved characters, not empty, not too long. */
export function cleanFileName(name: string, fallback = "document") {
    const cleaned = name
        .normalize("NFC")
        // Control characters too: they break file names on every system.
        // eslint-disable-next-line no-control-regex
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
        .replace(/\s+/g, " ")
        .replace(/^[.\s]+|[.\s]+$/g, "")
        .slice(0, 120);
    return cleaned || fallback;
}
