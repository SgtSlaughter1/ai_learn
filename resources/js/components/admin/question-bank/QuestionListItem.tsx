import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { QuestionItem } from '@/types/admin';

interface QuestionListItemProps {
    question: QuestionItem;
    onEdit: (q: QuestionItem) => void;
    onDelete: (q: QuestionItem) => void;
}

export default function QuestionListItem({ question: q, onEdit, onDelete }: QuestionListItemProps) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4 hover:border-[var(--color-primary)]/40 transition-colors">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] text-[10px] font-bold uppercase border border-[var(--color-border)]">
                            {q.topic?.subject?.name || 'Subject'} • {q.topic?.name || 'Topic'}
                        </span>
                        {q._pendingSync && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent)]/25">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse"></span>
                                Pending Sync
                            </span>
                        )}
                        <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                q.difficulty === 'easy'
                                    ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success)]/20'
                                    : q.difficulty === 'hard'
                                    ? 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error)]/20'
                                    : 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent)]/20'
                            }`}
                        >
                            {q.difficulty}
                        </span>
                    </div>
                    <div className="text-sm font-bold text-[var(--color-text)] pt-1 [&_p]:inline">
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {q.question_text}
                        </Markdown>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onEdit(q)}
                        className="px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all border border-[var(--color-border)]"
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(q)}
                        className="px-3 py-1.5 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] active:scale-[0.98] cursor-pointer rounded-lg transition-all"
                    >
                        Delete
                    </button>
                </div>
            </div>

            {/* Options Grid */}
            <div className="grid md:grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                {q.options.map((opt, idx) => (
                    <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between ${
                            opt.is_correct
                                ? 'border-[var(--color-success)]/40 bg-[var(--color-success-10)] text-[var(--color-success)] font-bold'
                                : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]'
                        }`}
                    >
                        <span className="[&_p]:inline">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {opt.option_text}
                            </Markdown>
                        </span>
                        {opt.is_correct && (
                            <span className="text-xs flex items-center gap-1 shrink-0 ml-2">
                                <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Correct Answer</span>
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {q.explanation && (
                <div className="text-[11px] text-[var(--color-muted)] bg-[var(--color-primary-5)] border border-[var(--color-border)] p-2.5 rounded-xl flex items-start gap-2">
                    <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="[&_p]:inline">
                        <strong className="text-[var(--color-text)] font-semibold">Explanation: </strong>
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {q.explanation}
                        </Markdown>
                    </div>
                </div>
            )}
        </div>
    );
}
