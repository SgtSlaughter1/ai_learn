import { visit } from 'unist-util-visit';
import type { Root, Strong } from 'mdast';
import type { VFile } from 'vfile';

/**
 * Exam papers underline words ("the word nearest in meaning to the underlined word").
 * Markdown has no underline, and raw HTML is off, so __word__ means underline here while
 * **word** stays bold. Both parse as `strong`; the source text tells them apart.
 */
export function remarkUnderline() {
    return (tree: Root, file: VFile) => {
        const source = String(file.value ?? '');
        visit(tree, 'strong', (node: Strong) => {
            const start = node.position?.start.offset;
            if (start === undefined || source.slice(start, start + 2) !== '__') return;
            node.data = { ...(node.data ?? {}), hName: 'u', hProperties: { className: ['rich-underline'] } };
        });
    };
}
