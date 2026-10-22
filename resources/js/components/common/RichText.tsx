import { memo } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';
import { remarkUnderline } from './remarkUnderline';

/**
 * The one renderer for question, option, passage and explanation text, so the question
 * form's preview always matches what learners see. Supports:
 *  - maths: $x^2$, $$\frac{a}{b}$$ (KaTeX)
 *  - chemistry: $\ce{H2SO4}$, $\ce{N2 + 3H2 <=> 2NH3}$ (KaTeX mhchem)
 *  - tables: GitHub-style | a | b | rows
 *  - underline: __word__ (exam style; **word** stays bold)
 *  - poems and extracts: a ```poem fenced block keeps every line break
 * Raw HTML is never rendered: text comes from teachers at many schools.
 */

const remarkPlugins = [remarkGfm, remarkMath, remarkUnderline];
const rehypePlugins = [[rehypeKatex, { throwOnError: false, strict: 'ignore' }]] as never;

function PoemBlock({ text }: { text: string }) {
    return (
        <div className="rich-poem my-2 whitespace-pre-wrap font-serif leading-relaxed border-l-0 pl-0">
            {text.replace(/\n$/, '')}
        </div>
    );
}

const components: Components = {
    code({ className, children, ...props }) {
        if (className === 'language-poem') {
            return <PoemBlock text={String(children)} />;
        }
        return <code className={className} {...props}>{children}</code>;
    },
    pre({ children, node }) {
        // A poem block renders its own wrapper; anything else is a normal code block.
        const first = node?.children?.[0];
        const isPoem = first && first.type === 'element' && Array.isArray(first.properties?.className)
            && (first.properties.className as string[]).includes('language-poem');
        return isPoem ? <>{children}</> : <pre>{children}</pre>;
    },
    table({ children }) {
        return (
            <div className="rich-table my-2 overflow-x-auto">
                <table>{children}</table>
            </div>
        );
    },
    img({ src, alt }) {
        return <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} loading="lazy" className="max-w-full rounded-xl" />;
    },
    a({ href, children }) {
        return <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>;
    },
};

const inlineComponents: Components = {
    ...components,
    // Options sit inside buttons: keep paragraphs inline so the text flows on one line.
    p({ children }) {
        return <span>{children}</span>;
    },
};

interface RichTextProps {
    text: string | null | undefined;
    /** Render paragraphs inline (for option labels inside buttons). */
    inline?: boolean;
    /** Wraps the output in an element with this class; without it nothing is added around it. */
    className?: string;
}

/**
 * AI models and text copied from other tools often write maths as \( ... \) and \[ ... \];
 * the renderer reads $ ... $ and $$ ... $$.
 */
export function normalizeMathDelimiters(text: string): string {
    return text
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => `$$${body.trim()}$$`)
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => `$${body.trim()}$`);
}

export const RichText = memo(function RichText({ text, inline = false, className }: RichTextProps) {
    if (!text) return null;
    const content = (
        <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={inline ? inlineComponents : components}>
            {normalizeMathDelimiters(text)}
        </Markdown>
    );
    if (!className) return content;
    return inline
        ? <span className={`rich-text ${className}`}>{content}</span>
        : <div className={`rich-text ${className}`}>{content}</div>;
});

export default RichText;
