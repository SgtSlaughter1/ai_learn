import { Link } from '@inertiajs/react';
import { BookOpen, RefreshCw } from 'lucide-react';

interface FlashcardSessionCompleteProps {
    xpEarned: number;
    cardsCount: number;
    isOnline: boolean;
    levelUpInfo: {
        level: number;
        tier: string;
        achievements: any[];
    } | null;
    onRestart: () => void;
}

export function FlashcardSessionComplete({
    xpEarned,
    cardsCount,
    isOnline,
    levelUpInfo,
    onRestart,
}: FlashcardSessionCompleteProps) {
    return (
        <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-10 rounded-3xl text-center space-y-6 shadow-xl hover:border-[var(--color-border)] transition-all">
            <div className="flex justify-center">
                <span className="p-4 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-full animate-bounce">
                    <BookOpen className="w-12 h-12" />
                </span>
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-extrabold text-[var(--color-text)]">Recall Session Complete!</h2>
                <p className="text-[var(--color-muted)] text-sm max-w-md mx-auto leading-relaxed">
                    Great job practicing active recall!{' '}
                    {!isOnline
                        ? 'Results will sync when you reconnect.'
                        : 'Reviewing concepts you recently struggled with dramatically speeds up long-term retention.'}
                </p>
            </div>

            <div className="max-w-md mx-auto bg-[var(--color-background)]/60 border border-[var(--color-border)] p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider">
                        XP Awarded
                    </span>
                    <span className="text-lg font-bold text-[var(--color-success)]">+{xpEarned} XP</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
                    <span>Cards Reviewed</span>
                    <span>{cardsCount} cards</span>
                </div>
                {!isOnline && (
                    <div className="flex items-center gap-2 text-xs text-[var(--color-accent)] font-semibold pt-2 border-t border-[var(--color-border)]">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Will sync when online
                    </div>
                )}
                {levelUpInfo && (
                    <div className="border-t border-[var(--color-border)] pt-4 mt-2 text-left space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-[var(--color-muted)] font-bold uppercase tracking-wider">
                                Current Standing
                            </span>
                            <span className="text-xs font-bold text-[var(--color-primary)]">
                                Level {levelUpInfo.level} ({levelUpInfo.tier})
                            </span>
                        </div>
                        {levelUpInfo.achievements.length > 0 && (
                            <div className="space-y-2">
                                <span className="block text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">
                                    Achievements Unlocked!
                                </span>
                                {levelUpInfo.achievements.map((ach: any) => (
                                    <div
                                        key={ach.key}
                                        className="flex items-center gap-2.5 p-2.5 bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl"
                                    >
                                        <span className="text-xl shrink-0">{ach.icon}</span>
                                        <div>
                                            <h4 className="text-xs font-bold text-[var(--color-text)]">{ach.name}</h4>
                                            <p className="text-[10px] text-[var(--color-muted)]">{ach.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <button
                    type="button"
                    onClick={onRestart}
                    className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-xl font-bold shadow-lg shadow-teal-600/15 transition-all min-h-[48px] cursor-pointer"
                >
                    Start Another Deck
                </button>
                <Link
                    href="/dashboard"
                    className="px-6 py-3 bg-[var(--color-background)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-slate-700 text-[var(--color-text)] rounded-xl font-bold transition-all min-h-[48px] flex items-center justify-center"
                >
                    Go to Dashboard
                </Link>
            </div>
        </div>
    );
}
