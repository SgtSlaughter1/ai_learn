import React from 'react';
import { Flame, Shield, Trophy, ArrowRight, Zap, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { GamificationData } from './LevelProgressBar';

interface Props {
    gamification: GamificationData | null;
    onOpenChallenge: () => void;
}

export const DailyStreakChallengeCard: React.FC<Props> = ({
    gamification,
    onOpenChallenge,
}) => {
    const streak = gamification?.current_streak ?? 0;
    const status = gamification?.streak_status ?? (streak > 0 ? 'at_risk' : 'inactive');
    const title = gamification?.streak_title ?? (streak >= 3 ? 'Curious Thinker' : 'Beginner');
    const shields = gamification?.streak_freeze_count ?? 1;
    const isProtected = gamification?.is_protected_today ?? (status === 'active_today');
    const hoursLeft = gamification?.hours_remaining_today ?? 8;
    const nextMilestone = gamification?.next_milestone ?? {
        target_days: streak < 3 ? 3 : (streak < 7 ? 7 : 14),
        title: streak < 3 ? 'Curious Thinker' : (streak < 7 ? 'Unstoppable' : 'Exam Champion'),
        days_remaining: Math.max(0, (streak < 3 ? 3 : (streak < 7 ? 7 : 14)) - streak),
        percent: Math.min(100, Math.round((streak / (streak < 3 ? 3 : (streak < 7 ? 7 : 14))) * 100)),
    };

    return (
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-8 shadow-sm transition-all duration-300 hover:shadow-md">
            {/* Background dynamic ambient flame auras matching theme tokens */}
            <div
                className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-700 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]"
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                {/* Left Column: Visual Flame Counter + Status */}
                <div className="flex items-start sm:items-center gap-5">
                    {/* Animated Flame Icon Token */}
                    <div className="relative shrink-0">
                        <div
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border-2 shadow-inner relative transition-transform duration-300 hover:scale-105 cursor-pointer ${
                                isProtected
                                    ? 'bg-[var(--color-success-10)] border-[var(--color-success)] text-[var(--color-success)]'
                                    : status === 'at_risk'
                                    ? 'bg-[var(--color-accent-10)] border-[var(--color-accent)] text-[var(--color-accent)] animate-pulse'
                                    : 'bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-accent)]'
                            }`}
                            onClick={onOpenChallenge}
                            title="Open Daily Streak Challenge"
                        >
                            <Flame
                                className={`w-9 h-9 sm:w-11 sm:h-11 ${
                                    isProtected
                                        ? 'text-[var(--color-success)] drop-shadow-[0_0_8px_rgba(63,125,88,0.5)]'
                                        : 'text-[var(--color-accent)] drop-shadow-[0_0_10px_rgba(217,154,61,0.6)]'
                                }`}
                            />
                            {streak > 0 && (
                                <span className="absolute -bottom-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--color-accent)] text-[var(--color-surface)] shadow-xs border border-[var(--color-border)]">
                                    {streak}d
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Streak Info & Loss Aversion Hook */}
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl sm:text-2xl font-black text-[var(--color-text)] tracking-tight">
                                {streak > 0 ? `${streak}-Day Streak` : 'Daily Learning Streak'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]">
                                <Trophy className="w-3 h-3 shrink-0" />
                                {title}
                            </span>
                        </div>

                        {/* Psychological Loss Aversion / Status messaging */}
                        {isProtected ? (
                            <p className="text-xs sm:text-sm font-medium text-[var(--color-success)] flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--color-success)]" />
                                <span>Streak on Fire! Secured for today (+10 XP claimed).</span>
                            </p>
                        ) : status === 'at_risk' ? (
                            <p className="text-xs sm:text-sm font-semibold text-[var(--color-accent)] flex items-center gap-1.5 animate-pulse">
                                <AlertTriangle className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
                                <span>
                                    Your {streak}-day streak is at risk! ({hoursLeft}h left) Complete 1 question to protect it.
                                </span>
                            </p>
                        ) : (
                            <p className="text-xs sm:text-sm text-[var(--color-muted)] flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
                                <span>Complete today&apos;s 60-second challenge to ignite your streak!</span>
                            </p>
                        )}

                        {/* Milestone Progress bar */}
                        <div className="pt-1 flex items-center gap-3">
                            <div className="w-36 sm:w-48 bg-[var(--color-background)] border border-[var(--color-border)] h-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out bg-[var(--color-accent)]"
                                    style={{ width: `${nextMilestone.percent}%` }}
                                />
                            </div>
                            <span className="text-[11px] font-bold text-[var(--color-muted)] whitespace-nowrap">
                                {nextMilestone.days_remaining === 0
                                    ? `Milestone "${nextMilestone.title}" reached!`
                                    : `${nextMilestone.days_remaining}d to "${nextMilestone.title}"`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Freeze Shields & Action Button */}
                <div className="flex flex-row sm:flex-row lg:flex-col items-center lg:items-end justify-between sm:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-[var(--color-border)]">
                    {/* Freeze Shield Pill */}
                    <div className="flex items-center gap-2 bg-[var(--color-background)] px-3 py-1.5 rounded-xl border border-[var(--color-border)]">
                        <Shield className={`w-4 h-4 ${shields > 0 ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-muted)]'}`} />
                        <span className="text-xs font-bold text-[var(--color-text)]">
                            {shields > 0 ? `${shields} Freeze Shield${shields > 1 ? 's' : ''}` : 'No Shields'}
                        </span>
                        <span className="text-[10px] text-[var(--color-muted)] hidden sm:inline">
                            (Auto-protect)
                        </span>
                    </div>

                    {/* Quick Challenge CTA Button using Design System Tokens */}
                    <button
                        onClick={onOpenChallenge}
                        className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-200 cursor-pointer ${
                            isProtected
                                ? 'btn-secondary'
                                : 'btn-primary shadow-[var(--color-primary-10)] active:scale-95'
                        }`}
                    >
                        {isProtected ? (
                            <>
                                <Zap className="w-4 h-4 text-[var(--color-accent)]" />
                                <span>Streak Hub & Bonus Drill</span>
                            </>
                        ) : (
                            <>
                                <Flame className="w-4 h-4 text-[var(--color-accent)] animate-bounce" />
                                <span>Protect My Streak</span>
                                <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
