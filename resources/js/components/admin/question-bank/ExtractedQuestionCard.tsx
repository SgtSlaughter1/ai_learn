import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { ExtractedQuestion } from '@/utils/questionParser';

interface ExtractedQuestionCardProps {
    q: ExtractedQuestion;
    qIdx: number;
    onUpdateDifficulty: (qIdx: number, difficulty: string) => void;
    onDeleteExtractedQuestion: (qIdx: number) => void;
    onUpdateQuestionText: (qIdx: number, text: string) => void;
    onAddOptionToQuestion: (qIdx: number) => void;
    onSetCorrectOption: (qIdx: number, optIdx: number) => void;
    onUpdateOptionText: (qIdx: number, optIdx: number, text: string) => void;
    onRemoveOptionFromQuestion: (qIdx: number, optIdx: number) => void;
    onUpdateExplanation: (qIdx: number, text: string) => void;
}

export default function ExtractedQuestionCard({
    q,
    qIdx,
    onUpdateDifficulty,
    onDeleteExtractedQuestion,
    onUpdateQuestionText,
    onAddOptionToQuestion,
    onSetCorrectOption,
    onUpdateOptionText,
    onRemoveOptionFromQuestion,
    onUpdateExplanation,
}: ExtractedQuestionCardProps) {
    return (
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4 shadow-sm hover:border-[var(--color-primary)]/40 transition-all">
            {/* Card Top */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--color-primary)] text-white font-bold text-xs shadow-sm">
                        #{qIdx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)]">
                        {(['easy', 'medium', 'hard'] as const).map((diff) => (
                            <button
                                key={diff}
                                type="button"
                                onClick={() => onUpdateDifficulty(qIdx, diff)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                    q.difficulty === diff
                                        ? diff === 'easy'
                                            ? 'bg-[var(--color-success)] text-white shadow-sm'
                                            : diff === 'hard'
                                            ? 'bg-[var(--color-error)] text-white shadow-sm'
                                            : 'bg-[var(--color-accent)] text-white shadow-sm'
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                            >
                                {diff}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => onDeleteExtractedQuestion(qIdx)}
                    className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error-5)] rounded-lg transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Delete this question"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                    </svg>
                    <span>Remove</span>
                </button>
            </div>

            {/* Question Text */}
            <div>
                <label className="block text-[11px] font-bold text-[var(--color-muted)] mb-1">
                    Question Text
                </label>
                <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) => onUpdateQuestionText(qIdx, e.target.value)}
                    className="w-full px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)]"
                />
                {q.question_text &&
                    (q.question_text.includes('$') ||
                        q.question_text.includes('\\') ||
                        q.question_text.includes('^')) && (
                        <div className="mt-1 px-3 py-1.5 bg-[var(--color-primary-5)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] [&_p]:inline flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider shrink-0">
                                Math Preview:
                            </span>
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {q.question_text}
                            </Markdown>
                        </div>
                    )}
            </div>

            {/* Options List */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--color-muted)]">
                        Options (Select radio for correct answer):
                    </label>
                    <button
                        type="button"
                        onClick={() => onAddOptionToQuestion(qIdx)}
                        className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                        + Add Option
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => (
                        <div
                            key={optIdx}
                            onClick={() => onSetCorrectOption(qIdx, optIdx)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                opt.is_correct
                                    ? 'bg-[var(--color-success-10)] border-[var(--color-success)]/40 shadow-sm'
                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`bulk_correct_${qIdx}`}
                                checked={opt.is_correct}
                                onChange={() => onSetCorrectOption(qIdx, optIdx)}
                                className="h-4 w-4 text-[var(--color-success)] cursor-pointer accent-[var(--color-success)]"
                            />
                            <span className="font-bold text-xs text-[var(--color-muted)] w-5">
                                {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <input
                                type="text"
                                value={opt.option_text}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => onUpdateOptionText(qIdx, optIdx, e.target.value)}
                                className="flex-1 px-2.5 py-1 bg-transparent border-b border-transparent focus:border-[var(--color-primary)] outline-none text-xs text-[var(--color-text)] font-medium"
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`}
                            />
                            {opt.is_correct ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success)]/30 flex items-center gap-1 shadow-sm shrink-0">
                                    <svg className="w-3 h-3 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>AI Selected</span>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveOptionFromQuestion(qIdx, optIdx);
                                    }}
                                    className="text-[var(--color-muted)] hover:text-[var(--color-error)] p-1 text-xs shrink-0 cursor-pointer"
                                    title="Remove option"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Explanation */}
            <div>
                <label className="block text-[11px] font-bold text-[var(--color-muted)] mb-1">
                    Solution Explanation
                </label>
                <input
                    type="text"
                    value={q.explanation || ''}
                    onChange={(e) => onUpdateExplanation(qIdx, e.target.value)}
                    placeholder="Explanation for students..."
                    className="w-full px-3.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                />
            </div>
        </div>
    );
}
