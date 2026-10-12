import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Sparkles, Check, X, Lightbulb, CheckCircle2, XCircle } from 'lucide-react';
import { formatMathText } from '@/utils/mathFormatter';

export interface ResultOption {
    id: number;
    option_text: string;
    is_correct: boolean;
}

export interface ResultAnswer {
    id: string;
    question_id: number;
    question_text: string;
    image_url?: string | null;
    explanation: string;
    selected_option_id: number | null;
    is_correct: boolean;
    marks_awarded: number;
    options: ResultOption[];
}

interface ResultQuestionBreakdownProps {
    answers: ResultAnswer[];
    onAskAi: (questionId: number, questionText: string, selectedOptionId: number | null, answerObj?: ResultAnswer) => void;
}

export function ResultQuestionBreakdown({
    answers,
    onAskAi,
}: ResultQuestionBreakdownProps) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[var(--color-text)]">Questions Review</h2>
                <span className="text-xs font-semibold text-[var(--color-muted)]">
                    {answers.filter(a => a.is_correct).length} of {answers.length} Correct
                </span>
            </div>

            {answers.map((answer, idx) => {
                const selectedOpt = answer.options.find(o => o.id === answer.selected_option_id);
                const correctOpt = answer.options.find(o => o.is_correct);

                return (
                    <div
                        key={answer.id}
                        className={`bg-[var(--color-surface)] backdrop-blur-md border p-6 md:p-8 rounded-3xl space-y-6 transition-all ${
                            answer.is_correct
                                ? 'border-[var(--color-border)]'
                                : 'border-[var(--color-error)]/30 ring-1 ring-[var(--color-error)]/10'
                        }`}
                    >
                        {/* Question Title & Status */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                            <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider">
                                        Question {idx + 1}
                                    </span>
                                    <span
                                        className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                                            answer.is_correct
                                                ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]'
                                                : 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error-20)]'
                                        }`}
                                    >
                                        {answer.is_correct ? `✓ +${answer.marks_awarded} Marks` : '❌ Incorrect'}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {formatMathText(answer.question_text)}
                                    </Markdown>
                                </h3>
                                {answer.image_url && (
                                    <div className="flex justify-center my-3">
                                        <img
                                            src={answer.image_url}
                                            alt="Question diagram"
                                            className="max-h-56 max-w-full rounded-2xl border border-[var(--color-border)] shadow-xs object-contain bg-[var(--color-background)]"
                                            loading="lazy"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 self-start sm:self-auto">
                                {!answer.is_correct ? (
                                    <button
                                        type="button"
                                        onClick={() => onAskAi(answer.question_id, answer.question_text, answer.selected_option_id, answer)}
                                        className="text-xs font-black px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white rounded-xl transition-all shadow-md hover:shadow-lg min-h-[38px] flex items-center gap-2 focus:outline-none cursor-pointer transform hover:-translate-y-0.5"
                                    >
                                        <Lightbulb className="w-4 h-4 text-amber-200" />
                                        <span>Why am I wrong?</span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onAskAi(answer.question_id, answer.question_text, answer.selected_option_id, answer)}
                                        className="text-xs font-bold px-3 py-1.5 bg-[var(--color-background)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl transition-all min-h-[36px] flex items-center gap-1.5 focus:outline-none cursor-pointer"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                        <span>AI Breakdown</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Mistake Comparison Summary (for incorrect answers) */}
                        {!answer.is_correct && (
                            <div className="p-4 rounded-2xl bg-[var(--color-background)]/60 border border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-error)]">
                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                        Your Answer:
                                    </span>
                                    <div className="text-xs font-bold text-[var(--color-text)] chat-markdown [&_p]:inline">
                                        {selectedOpt ? (
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {formatMathText(selectedOpt.option_text)}
                                            </Markdown>
                                        ) : (
                                            <span className="text-[var(--color-muted)] italic">None (Skipped)</span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-success)]">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        Correct Answer:
                                    </span>
                                    <div className="text-xs font-bold text-[var(--color-text)] chat-markdown [&_p]:inline">
                                        {correctOpt ? (
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {formatMathText(correctOpt.option_text)}
                                            </Markdown>
                                        ) : (
                                            <span className="text-[var(--color-muted)] italic">Option A</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Options review layout */}
                        <div className="space-y-2.5">
                            {answer.options.map((option, optIdx) => {
                                const isSelected = answer.selected_option_id === option.id;
                                const isCorrect = option.is_correct;

                                let optionClass =
                                    'border-[var(--color-border)] text-[var(--color-muted)] bg-[var(--color-background)]/30';
                                if (isCorrect) {
                                    optionClass = 'border-[var(--color-success)] bg-[var(--color-success-10)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]/30';
                                } else if (isSelected && !isCorrect) {
                                    optionClass = 'border-[var(--color-error)] bg-[var(--color-error-10)] text-[var(--color-error)] ring-1 ring-[var(--color-error)]/30';
                                }

                                return (
                                    <div
                                        key={option.id}
                                        className={`px-4 py-3 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 transition-all ${optionClass}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-xs font-extrabold text-[var(--color-text)] shrink-0">
                                                {String.fromCharCode(65 + optIdx)}
                                            </span>
                                            <div className="chat-markdown text-[var(--color-text)] [&_p]:inline">
                                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                    {formatMathText(option.option_text)}
                                                </Markdown>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 shrink-0">
                                            {isSelected && (
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                                    Your choice
                                                </span>
                                            )}
                                            {isCorrect ? (
                                                <Check className="w-4 h-4 text-[var(--color-success)]" />
                                            ) : isSelected && !isCorrect ? (
                                                <X className="w-4 h-4 text-[var(--color-error)]" />
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Explanation Box */}
                        {answer.explanation && (
                            <div className="p-4.5 bg-[var(--color-primary-5)]/40 border border-[var(--color-primary)]/20 rounded-2xl space-y-1.5">
                                <span className="block text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider">
                                    Official Explanation Working
                                </span>
                                <div className="chat-markdown text-xs text-[var(--color-text)] leading-relaxed font-medium">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {formatMathText(answer.explanation)}
                                    </Markdown>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
