// Text for the menu bar answer: one line of plain text, split into pages that fit the window width.
// Pure functions so they can be unit tested; the menu bar page passes a canvas-based measure function.

const LINE_SEPARATOR = ' · ';

function stripInlineMarkdown(line) {
    return (
        line
            // [text](url) -> text
            .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
            .replace(/`([^`]*)`/g, '$1')
            .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
            .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1')
            // *x* and _x_ only when they wrap words, so 2*3*4 and snake_case stay as they are
            .replace(/(^|[^\w*])\*(?=\S)([^*]+?)(?<=\S)\*(?![\w*])/g, '$1$2')
            .replace(/(^|[^\w])_(?=\S)([^_]+?)(?<=\S)_(?!\w)/g, '$1$2')
    );
}

function toMenuBarText(markdown) {
    if (typeof markdown !== 'string') return '';

    const lines = [];
    for (const rawLine of markdown.split('\n')) {
        if (/^\s*(```|~~~)/.test(rawLine)) continue;
        const line = stripInlineMarkdown(
            rawLine
                .replace(/^\s*#{1,6}\s+/, '')
                .replace(/^\s*>\s?/, '')
                .replace(/^\s*[-*+]\s+/, '')
        )
            .replace(/\s+/g, ' ')
            .trim();
        if (line) lines.push(line);
    }
    return lines.join(LINE_SEPARATOR);
}

// Greedy word wrap: each page is the longest run of words whose width fits maxWidth.
function paginate(text, maxWidth, measure = s => s.length) {
    const words = String(text || '')
        .split(/\s+/)
        .filter(Boolean);
    const pages = [];
    let current = '';

    for (let word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (measure(candidate) <= maxWidth) {
            current = candidate;
            continue;
        }
        if (current) pages.push(current);
        current = '';

        while (measure(word) > maxWidth && word.length > 1) {
            let end = word.length - 1;
            while (end > 1 && measure(word.slice(0, end)) > maxWidth) end--;
            pages.push(word.slice(0, end));
            word = word.slice(end);
        }
        current = word;
    }
    if (current) pages.push(current);
    return pages;
}

function clampPage(page, total) {
    if (!total || !Number.isFinite(page)) return 0;
    return Math.min(total - 1, Math.max(0, Math.trunc(page)));
}

module.exports = { toMenuBarText, paginate, clampPage };
