import { RichText } from '@/components/common/RichText';

/** What a device needs to show a shared passage (QuestionContext::toLearnerArray). */
export interface QuizContext {
    id?: number;
    type: 'passage' | 'poem' | 'diagram' | 'table' | string;
    title: string | null;
    instructions: string | null;
    body: string | null;
    image_url: string | null;
    show_line_numbers: boolean;
}

export const CONTEXT_TYPE_LABELS: Record<string, string> = {
    passage: 'Passage',
    poem: 'Poem or extract',
    diagram: 'Diagram',
    table: 'Table',
};

/**
 * A passage, poem, diagram or table, as learners see it. Poems, and passages with line
 * numbers, keep every line break as typed, numbered for "in line 12" questions.
 */
export function PassageView({ context, label, compact = false }: { context: QuizContext; label?: string | null; compact?: boolean }) {
    const byLine = context.show_line_numbers || context.type === 'poem';
    let lineNo = 0;
    const lines = (context.body ?? '').replace(/\r\n?/g, '\n').split('\n');

    return (
        <div className={`space-y-3 ${compact ? 'text-sm' : 'text-[15px] md:text-base'}`}>
            {label && (
                <span className="inline-flex text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                    {label}
                </span>
            )}
            {context.title && (
                <p role="heading" aria-level={2} className={`${compact ? 'text-base' : 'text-lg md:text-xl'} font-extrabold text-[var(--color-text)]`}>
                    {context.title}
                </p>
            )}
            {context.instructions && (
                <p className="text-xs md:text-sm italic text-[var(--color-muted)]">{context.instructions}</p>
            )}
            {context.image_url && (
                <img
                    src={context.image_url}
                    alt={context.title ? `${context.title} (diagram)` : 'Diagram for these questions'}
                    loading="lazy"
                    className="max-h-80 w-auto max-w-full mx-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] object-contain"
                />
            )}
            {context.body && (byLine ? (
                <div className="leading-relaxed text-[var(--color-text)]">
                    {lines.map((line, i) => {
                        if (!line.trim()) return <div key={i} className="h-3" aria-hidden="true" />;
                        lineNo += 1;
                        return (
                            <div key={i} className={context.show_line_numbers ? 'grid grid-cols-[2rem_1fr] gap-2' : ''}>
                                {context.show_line_numbers && (
                                    <span className="text-right text-[11px] pt-1 text-[var(--color-muted)] select-none tabular-nums">{lineNo}</span>
                                )}
                                <span className={context.type === 'poem' ? 'font-serif' : ''}>
                                    <RichText text={line} inline />
                                </span>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <RichText text={context.body} className="leading-relaxed text-[var(--color-text)] space-y-2" />
            ))}
        </div>
    );
}

export default PassageView;
