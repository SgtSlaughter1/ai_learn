import { Head } from '@inertiajs/react';
import { WifiOff, FileText, Sparkles, HelpCircle, Clock } from 'lucide-react';

interface QuizModeSelectProps {
    quizTitle: string;
    description: string | null;
    questionCount: number;
    timeLimitMinutes: number | null;
    isOnline: boolean;
    adaptiveLoading: boolean;
    onSelectStandard: () => void;
    onSelectAdaptive: () => void;
}

export function QuizModeSelect({
    quizTitle,
    description,
    questionCount,
    timeLimitMinutes,
    isOnline,
    adaptiveLoading,
    onSelectStandard,
    onSelectAdaptive,
}: QuizModeSelectProps) {
    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8">
            <Head title={quizTitle} />
            <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-center min-h-[80vh] space-y-10">
                {/* Offline Banner */}
                {!isOnline && (
                    <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl px-4 py-3 flex items-center gap-3 max-w-2xl w-full">
                        <WifiOff className="w-5 h-5 text-[var(--color-accent)] shrink-0" />
                        <span className="text-sm font-semibold text-[var(--color-accent)]">
                            You are offline. Standard quizzes are available, and your answers will sync when you reconnect.
                        </span>
                    </div>
                )}

                {/* Quiz Info Card */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 md:p-12 rounded-3xl backdrop-blur-md text-center space-y-6 max-w-2xl w-full">
                    <span className="text-[10px] font-extrabold px-3 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded-md tracking-wider uppercase">
                        Assessment
                    </span>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text)] leading-tight">
                        {quizTitle}
                    </h1>
                    {description && (
                        <p className="text-[var(--color-muted)] text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                            {description}
                        </p>
                    )}
                    <div className="flex items-center justify-center gap-6 text-sm text-[var(--color-muted)]">
                        <span className="flex items-center gap-1.5">
                            <HelpCircle className="w-4 h-4" />
                            {questionCount} Questions
                        </span>
                        {timeLimitMinutes && (
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-4 h-4" />
                                {timeLimitMinutes} min
                            </span>
                        )}
                    </div>
                </div>

                {/* Mode Selection Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
                    {/* Standard Quiz */}
                    <button
                        type="button"
                        onClick={onSelectStandard}
                        className="group bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl text-left transition-all hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)] hover:shadow-xl hover:shadow-[var(--color-accent)]/5 focus:outline-none cursor-pointer"
                    >
                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-border)] flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 group-hover:border-[var(--color-accent)]/30 transition-all">
                                <FileText className="w-6 h-6 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">
                                Standard Quiz
                            </h3>
                            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                                All questions presented in fixed order. Submit all answers at the end. Works offline!
                            </p>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 rounded tracking-wider uppercase">
                                Offline Ready
                            </span>
                        </div>
                    </button>

                    {/* Adaptive Quiz */}
                    <button
                        type="button"
                        onClick={onSelectAdaptive}
                        disabled={adaptiveLoading || !isOnline}
                        className="group bg-[var(--color-surface)] border border-[var(--color-accent)]/20 p-8 rounded-3xl text-left transition-all hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-accent)]/5 hover:shadow-lg focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="space-y-4">
                            <div className="h-12 w-12 rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 group-hover:border-[var(--color-accent)]/30 transition-all">
                                {adaptiveLoading ? (
                                    <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Sparkles className="w-6 h-6 text-[var(--color-accent)] group-hover:text-[var(--color-accent-hover)] transition-colors" />
                                )}
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-accent)] group-hover:text-[var(--color-accent-hover)] transition-colors flex items-center gap-1.5">
                                <span>Adaptive Quiz</span>
                                <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                            </h3>
                            <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                                AI-powered difficulty adjustment. Requires internet connection.
                            </p>
                            <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded tracking-wider uppercase">
                                {isOnline ? 'AI-Powered' : 'Requires Internet'}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
