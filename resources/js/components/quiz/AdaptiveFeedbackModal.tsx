import { Head } from '@inertiajs/react';
import { RichText } from '@/components/common/RichText';
import { Check, X } from 'lucide-react';

interface AdaptiveFeedbackModalProps {
    isCorrect: boolean;
    explanation: string;
    abilityScore?: number;
    difficultyLabel?: string;
    onContinue: () => void;
}

export function AdaptiveFeedbackModal({
    isCorrect,
    explanation,
    abilityScore,
    difficultyLabel,
    onContinue,
}: AdaptiveFeedbackModalProps) {
    const getDifficultyColor = (label?: string) => {
        switch (label) {
            case 'Beginner':
                return 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20';
            case 'Developing':
                return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'Proficient':
            case 'Advanced':
                return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20';
            case 'Expert':
                return 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20';
            default:
                return 'text-[var(--color-muted)] bg-slate-500/10 border-slate-500/20';
        }
    };

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8">
            <Head title="Answer Feedback" />
            <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-center min-h-[70vh] space-y-8">
                <div
                    className={`bg-[var(--color-surface)] border p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl backdrop-blur-md text-center space-y-5 sm:space-y-6 max-w-2xl w-full ${
                        isCorrect ? 'border-[var(--color-success)]/20' : 'border-[var(--color-error)]/20'
                    }`}
                >
                    <div
                        className={`h-14 w-14 sm:h-16 sm:w-16 rounded-full mx-auto flex items-center justify-center ${
                            isCorrect
                                ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/20'
                                : 'bg-[var(--color-error)]/10 border border-[var(--color-error)]/20'
                        }`}
                    >
                        {isCorrect ? (
                            <Check className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--color-success)]" />
                        ) : (
                            <X className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--color-error)]" />
                        )}
                    </div>

                    <h2
                        className={`text-xl sm:text-2xl font-extrabold ${
                            isCorrect ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'
                        }`}
                    >
                        {isCorrect ? 'Correct!' : 'Not Quite!'}
                    </h2>

                    {abilityScore !== undefined && (
                        <div className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
                            <span className="text-xs sm:text-sm text-[var(--color-muted)]">Ability:</span>
                            <span className="text-base sm:text-lg font-bold text-[var(--color-accent)]">{abilityScore}</span>
                            {difficultyLabel && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getDifficultyColor(difficultyLabel)}`}>
                                    {difficultyLabel}
                                </span>
                            )}
                        </div>
                    )}

                    {explanation && (
                        <div className="p-4 sm:p-5 bg-[var(--color-primary-5)]/40 border border-[var(--color-border)] rounded-2xl text-left space-y-2">
                            <span className="block text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider">
                                Explanation
                            </span>
                            <div className="chat-markdown text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                                <RichText text={explanation} />
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onContinue}
                    className="w-full sm:w-auto px-8 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-extrabold shadow-sm transition-all focus:outline-none min-h-[48px] cursor-pointer text-center"
                >
                    Next Question →
                </button>
            </div>
        </div>
    );
}
