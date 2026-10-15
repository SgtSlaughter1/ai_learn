import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export interface QuestionOption {
    id: number;
    option_text: string;
}

export interface QuizQuestion {
    id: number;
    topic_id?: number;
    question_text: string;
    image_url?: string | null;
    type: string;
    difficulty?: string;
    explanation?: string;
    /** Marks this question is worth in its quiz (from the server; 1 if unknown). */
    marks?: number;
    options: QuestionOption[];
}

interface QuestionCardProps {
    question: QuizQuestion;
    selectedOptionId: number | null;
    onSelectOption: (optionId: number) => void;
    onSkip?: () => void;
}

export function QuestionCard({
    question,
    selectedOptionId,
    onSelectOption,
    onSkip,
}: QuestionCardProps) {
    const getDifficultyBadge = (difficulty?: string) => {
        switch (difficulty) {
            case 'easy':
                return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20';
            case 'medium':
                return 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20';
            case 'hard':
                return 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20';
            default:
                return 'bg-slate-500/10 text-[var(--color-muted)] border-slate-500/20';
        }
    };

    return (
        <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)]/80 p-6 md:p-10 rounded-3xl shadow-xl flex flex-col justify-between space-y-8">
            <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded-md tracking-wider uppercase">
                        {question.type.replace('_', ' ')}
                    </span>
                    {question.difficulty && (
                        <span
                            className={`text-[10px] font-extrabold px-2 py-0.5 border rounded-md tracking-wider uppercase ${getDifficultyBadge(
                                question.difficulty
                            )}`}
                        >
                            {question.difficulty}
                        </span>
                    )}
                </div>

                {/* Attached Diagram / Image */}
                {question.image_url && (
                    <div className="flex justify-center my-3">
                        <img
                            src={question.image_url}
                            alt="Question diagram"
                            className="max-h-64 max-w-full rounded-2xl border border-[var(--color-border)] shadow-sm object-contain bg-[var(--color-background)]"
                            loading="lazy"
                        />
                    </div>
                )}

                <div className="chat-markdown text-lg md:text-xl font-bold leading-relaxed text-[var(--color-text)]">
                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {question.question_text}
                    </Markdown>
                </div>
            </div>

            <div className="space-y-3.5">
                {question.options.map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            onClick={() => onSelectOption(option.id)}
                            className={`w-full text-left px-5 py-4 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-between min-h-[58px] focus:outline-none cursor-pointer ${
                                isSelected
                                    ? 'bg-[var(--color-primary-5)] text-[var(--color-primary)] border-[var(--color-primary)] shadow-sm'
                                    : 'bg-[var(--color-background)]/40 hover:bg-[var(--color-primary-5)]/40 text-[var(--color-text)] border-[var(--color-border)]'
                            }`}
                        >
                            <span className="leading-snug [&_p]:inline">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {option.option_text}
                                </Markdown>
                            </span>
                            <div
                                className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ml-3 ${
                                    isSelected
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]'
                                        : 'border-[var(--color-border)] bg-[var(--color-background)]'
                                }`}
                            >
                                {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                            </div>
                        </button>
                    );
                })}

                {onSkip && (
                    <button
                        type="button"
                        onClick={onSkip}
                        className="w-full text-center py-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors font-semibold cursor-pointer"
                    >
                        Skip this question →
                    </button>
                )}
            </div>
        </div>
    );
}
