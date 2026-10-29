import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Legal text from resources/legal, set for reading: short measure, clear headings, tables that scroll on phones. */
export default function LegalText({ markdown }: { markdown: string }) {
    return (
        <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
                h2: ({ children }) => <h2 className="mt-10 mb-3 text-lg font-bold text-[var(--color-text)]">{children}</h2>,
                p: ({ children }) => <p className="my-3 leading-relaxed text-[var(--color-text)]">{children}</p>,
                ul: ({ children }) => <ul className="my-3 list-disc pl-5 space-y-1.5 text-[var(--color-text)]">{children}</ul>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                a: ({ href, children }) => (
                    <a href={href} className="text-[var(--color-primary)] underline underline-offset-2">
                        {children}
                    </a>
                ),
                table: ({ children }) => (
                    <div className="my-4 overflow-x-auto rounded-xl border border-[var(--color-border)]">
                        <table className="w-full text-sm">{children}</table>
                    </div>
                ),
                thead: ({ children }) => <thead className="bg-[var(--color-surface-hover)] text-left">{children}</thead>,
                th: ({ children }) => <th className="px-3 py-2 font-bold text-[var(--color-text)] align-top">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border-t border-[var(--color-border)] align-top text-[var(--color-text)]">{children}</td>,
            }}
        >
            {markdown}
        </Markdown>
    );
}
