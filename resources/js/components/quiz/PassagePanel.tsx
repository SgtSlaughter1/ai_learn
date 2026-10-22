import { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { PassageView, CONTEXT_TYPE_LABELS, type QuizContext } from './PassageView';

/**
 * The passage beside the current question. On a wide screen it stays pinned on the left
 * and scrolls on its own; on a phone it folds into a "Read passage" bar above the
 * question. Give it a key per passage: moving to the next question about the same passage
 * keeps it open at the same scroll position.
 */
export function PassagePanel({ context, label }: { context: QuizContext; label: string }) {
    const [open, setOpen] = useState(true);
    const kind = (CONTEXT_TYPE_LABELS[context.type] ?? 'Passage').toLowerCase();

    return (
        <section
            aria-label={context.title || CONTEXT_TYPE_LABELS[context.type] || 'Passage'}
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl overflow-hidden lg:sticky lg:top-4"
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="lg:hidden w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
            >
                <BookOpen className="w-5 h-5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                    <span className="block text-sm font-extrabold text-[var(--color-text)]">{open ? `Hide ${kind}` : `Read ${kind}`}</span>
                    <span className="block text-xs text-[var(--color-muted)] truncate">{context.title ? `${context.title} · ` : ''}{label}</span>
                </span>
                <ChevronDown className={`w-5 h-5 text-[var(--color-muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            <div className={`${open ? 'block' : 'hidden'} lg:block border-t lg:border-t-0 border-[var(--color-border)] p-5 md:p-7 max-h-[55vh] lg:max-h-[calc(100vh-10rem)] overflow-y-auto`}>
                <PassageView context={context} label={label} />
            </div>
        </section>
    );
}

export default PassagePanel;
