import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Sparkles, Check, X } from 'lucide-react';

export interface ResultOption {
    id: number;
    option_text: string;
    is_correct: boolean;
}

export interface ResultAnswer {
    id: string;
    question_id: number;
    question_text: string;
    explanation: string;
    selected_option_id: number | null;
    is_correct: boolean;
    marks_awarded: number;
    options: ResultOption[];
}

interface ResultQuestionBreakdownProps {
    answers: ResultAnswer[];
    onAskAi: (questionId: number, questionText: string, selectedOptionId: number | null) => void;
}

export function ResultQuestionBreakdown({
    answers,
    onAskAi,
}: ResultQuestionBreakdownProps) {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-[var(--color-text)]">Questions Review</h2>

            {answers.map((answer, idx) => (
                <div
                    key={answer.id}
                    className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-6 md:p-8 rounded-3xl space-y-6"
                >
                    {/* Question Title & Score mapping */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="space-y-2">
                            <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                                Question {idx + 1}
                            </span>
                            <h3 className="text-lg font-bold text-[var(--color-text)] leading-relaxed">
                                {answer.question_text}
                            </h3>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => onAskAi(answer.question_id, answer.question_text, answer.selected_option_id)}
                                className="text-xs font-bold px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg transition-colors shadow-lg shadow-[var(--color-primary)]/10 min-h-[36px] flex items-center gap-1.5 focus:outline-none cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>Ask AI</span>
                            </button>
                            <span
                                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border uppercase ${
                                    answer.is_correct
                                        ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20'
                                        : 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20'
                                }`}
                            >
                                {answer.is_correct ? `+${answer.marks_awarded} Marks` : 'Incorrect'}
                            </span>
                        </div>
                    </div>

                    {/* Options review layout */}
                    <div className="space-y-3">
                        {answer.options.map((option) => {
                            const isSelected = answer.selected_option_id === option.id;
                            const isCorrect = option.is_correct;

                            let optionClass =
                                'border-[var(--color-border)] text-[var(--color-muted)] bg-[var(--color-background)]/20';
                            if (isCorrect) {
                                optionClass = 'border-emerald-500 bg-[var(--color-success)]/10 text-emerald-300';
                            } else if (isSelected && !isCorrect) {
                                optionClass = 'border-rose-500 bg-[var(--color-error)]/10 text-rose-300';
                            }

                            return (
                                <div
                                    key={option.id}
                                    className={`px-5 py-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between ${optionClass}`}
                                >
                                    <span>{option.option_text}</span>
                                    <div className="flex items-center space-x-2">
                                        {isSelected && (
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                                Your choice
                                            </span>
                                        )}
                                        {isCorrect ? (
                                            <Check className="w-5 h-5 text-[var(--color-success)]" />
                                        ) : isSelected && !isCorrect ? (
                                            <X className="w-5 h-5 text-[var(--color-error)]" />
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Explanation Box */}
                    {answer.explanation && (
                        <div className="p-5 bg-[var(--color-primary-5)]/30 border border-[var(--color-primary)]/20 rounded-2xl space-y-1.5">
                            <span className="block text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
                                Answer Explanation
                            </span>
                            <div className="chat-markdown text-sm text-[var(--color-muted)] leading-relaxed">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {answer.explanation}
                                </Markdown>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
