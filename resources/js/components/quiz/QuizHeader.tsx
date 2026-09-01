import { Clock, WifiOff } from 'lucide-react';

interface QuizHeaderProps {
    title: string;
    currentQuestionNumber: number;
    totalQuestions: number;
    isOnline: boolean;
    secondsRemaining: number | null;
    adaptiveAbilityScore?: number;
    adaptiveDifficultyLabel?: string;
}

export function QuizHeader({
    title,
    currentQuestionNumber,
    totalQuestions,
    isOnline,
    secondsRemaining,
    adaptiveAbilityScore,
    adaptiveDifficultyLabel,
}: QuizHeaderProps) {
    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

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
        <header className="max-w-4xl w-full mx-auto flex justify-between items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-4 md:p-6 rounded-2xl backdrop-blur-md">
            <div className="space-y-1">
                <h1 className="text-lg md:text-xl font-extrabold text-[var(--color-text)] truncate max-w-[200px] sm:max-w-md">
                    {title}
                </h1>
                <span className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider block">
                    Question {currentQuestionNumber} of {totalQuestions}
                </span>
            </div>

            <div className="flex items-center gap-3">
                {!isOnline && (
                    <div className="px-3 py-1.5 rounded-xl border bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-bold flex items-center gap-1.5">
                        <WifiOff className="w-3.5 h-3.5" />
                        Offline
                    </div>
                )}

                {adaptiveAbilityScore !== undefined && (
                    <div
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${getDifficultyColor(
                            adaptiveDifficultyLabel
                        )}`}
                    >
                        <span>{adaptiveAbilityScore}</span>
                    </div>
                )}

                {secondsRemaining !== null && (
                    <div
                        className={`px-4 py-2 rounded-xl border flex items-center space-x-2 text-sm font-bold ${
                            secondsRemaining < 60
                                ? 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20 animate-pulse'
                                : 'bg-[var(--color-background)]/60 text-[var(--color-accent)] border-[var(--color-border)]'
                        }`}
                    >
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(secondsRemaining)}</span>
                    </div>
                )}
            </div>
        </header>
    );
}
