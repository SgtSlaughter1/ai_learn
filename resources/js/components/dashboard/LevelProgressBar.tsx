import { Flame, Trophy, HelpCircle } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { AchievementsGrid, DashboardAchievement } from './AchievementsGrid';
import { XpGuideModal } from './XpGuideModal';

export interface GamificationData {
    total_xp: number;
    level: number;
    tier: string;
    tier_color: string;
    current_streak: number;
    longest_streak: number;
    streak_freeze_count?: number;
    streak_status?: 'active_today' | 'at_risk' | 'shield_armed' | 'broken' | 'inactive';
    streak_title?: string;
    next_milestone?: {
        target_days: number;
        title: string;
        days_remaining: number;
        percent: number;
    };
    is_protected_today?: boolean;
    hours_remaining_today?: number;
    xp_progress_percent: number;
    xp_into_level: number;
    xp_for_next_level: number;
    next_level: number;
    recent_xp: Array<{ amount: number; source: string; description?: string }>;
    achievements: DashboardAchievement[];
    locked_achievements: DashboardAchievement[];
    total_achievements: number;
    earned_achievements: number;
}

interface LevelProgressBarProps {
    gamification: GamificationData | null;
    loading?: boolean;
    activeTooltip: string | null;
    onToggleTooltip: (id: string | null) => void;
    showXpGuide: boolean;
    onToggleXpGuide: () => void;
}

export function LevelProgressBar({
    gamification,
    loading = false,
    activeTooltip,
    onToggleTooltip,
    showXpGuide,
    onToggleXpGuide,
}: LevelProgressBarProps) {
    if (loading || !gamification) {
        return (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between min-h-[320px]">
                <div>
                    <div className="flex items-center justify-between">
                        <Skeleton variant="text" className="h-5 w-36" animate="wave" />
                        <Skeleton variant="rounded" className="h-5 w-20 rounded-full" animate="wave" />
                    </div>
                    <Skeleton variant="text" className="h-3.5 w-48 mt-1.5" animate="wave" />
                </div>

                <div className="my-6 space-y-5">
                    <div className="flex items-center gap-4">
                        <Skeleton variant="rounded" className="h-14 w-14 rounded-2xl shrink-0" animate="wave" />
                        <div className="space-y-2 flex-1">
                            <Skeleton variant="text" className="h-4 w-full" animate="wave" />
                            <Skeleton variant="rounded" className="h-2.5 w-full rounded-full" animate="wave" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Skeleton variant="rounded" className="h-12 w-full rounded-xl" animate="wave" />
                        <Skeleton variant="rounded" className="h-12 w-full rounded-xl" animate="wave" />
                    </div>
                </div>

                <Skeleton variant="rounded" className="h-9 w-full rounded-xl" animate="wave" />
            </div>
        );
    }

    const progressPercent = Math.min(100, Math.max(0, gamification.xp_progress_percent));

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between min-h-[320px]">
            {/* Card Header matching Overall Mastery & Recent Quizzes */}
            <div>
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-bold text-[var(--color-text)]">Level & Progression</h2>
                    <span
                        className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border shrink-0 tracking-wide"
                        style={{
                            backgroundColor: `${gamification.tier_color}18`,
                            borderColor: `${gamification.tier_color}45`,
                            color: gamification.tier_color,
                        }}
                    >
                        {gamification.tier}
                    </span>
                </div>
                <p className="text-[var(--color-muted)] text-xs mt-1">Tier rank and XP progress milestones.</p>
            </div>

            {/* Middle Section: Emblem, XP Bar & Stats */}
            <div className="my-5 space-y-4">
                {/* Level Emblem + Fluid XP Progress Bar */}
                <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                        <div
                            className="h-14 w-14 rounded-2xl flex items-center justify-center text-xl font-black border-2 shadow-sm transition-transform hover:scale-105"
                            style={{
                                backgroundColor: `${gamification.tier_color}18`,
                                borderColor: `${gamification.tier_color}45`,
                                color: gamification.tier_color,
                            }}
                        >
                            L{gamification.level}
                        </div>
                        <span className="absolute -bottom-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] uppercase tracking-wider">
                            LVL
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-[var(--color-text)]">Level {gamification.level}</span>
                            <span className="text-[11px] font-extrabold text-[var(--color-muted)] tabular-nums">
                                {gamification.xp_into_level} / {gamification.xp_for_next_level} XP
                            </span>
                        </div>
                        {/* Fluid Progress Bar (w-full, never overflows) */}
                        <div className="w-full bg-[var(--color-background)] border border-[var(--color-border)] h-2.5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: gamification.tier_color,
                                }}
                            />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)] mt-1.5 font-semibold">
                            <span>{gamification.total_xp.toLocaleString()} total XP</span>
                            <span className="font-bold" style={{ color: gamification.tier_color }}>
                                {progressPercent}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Compact Mini Metric Stats: Streak & Badges */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-2.5 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                            <Flame className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-xs font-black text-[var(--color-text)]">
                                {gamification.current_streak} {gamification.current_streak === 1 ? 'day' : 'days'}
                            </span>
                            <span className="block text-[10px] text-[var(--color-muted)] font-semibold truncate">
                                Study Streak
                            </span>
                        </div>
                    </div>
                    <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-2.5 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                            <Trophy className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-xs font-black text-[var(--color-text)]">
                                {gamification.earned_achievements} unlocked
                            </span>
                            <span className="block text-[10px] text-[var(--color-muted)] font-semibold truncate">
                                Badges
                            </span>
                        </div>
                    </div>
                </div>

                {/* Achievements Unlocked chips (if any) or encouragement note */}
                {gamification.achievements && gamification.achievements.length > 0 ? (
                    <AchievementsGrid
                        achievements={gamification.achievements}
                        activeTooltip={activeTooltip}
                        onToggleTooltip={onToggleTooltip}
                    />
                ) : (
                    <p className="text-[11px] text-[var(--color-muted)] text-center py-1 font-medium">
                        Complete quizzes to unlock your first milestone badge!
                    </p>
                )}
            </div>

            {/* Card Footer Action: mirrors Overall Mastery footer badge */}
            <button
                type="button"
                onClick={onToggleXpGuide}
                className="w-full text-center text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] py-2.5 rounded-xl border border-[var(--color-border)] hover:border-[var(--color-primary-light)] flex items-center justify-center gap-1.5 font-medium transition-all cursor-pointer group shadow-2xs"
            >
                <HelpCircle className="w-4 h-4 text-sky-500 group-hover:scale-110 transition-transform" />
                <span>How to earn XP & rank up</span>
                <span className="text-[10px] text-[var(--color-muted)] transition-transform group-hover:translate-x-0.5">→</span>
            </button>

            {/* Portal XP Guide Modal Dialog */}
            <XpGuideModal isOpen={showXpGuide} onToggle={onToggleXpGuide} />
        </div>
    );
}
