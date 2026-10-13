import { Flame, Trophy, HelpCircle } from 'lucide-react';
import { Skeleton } from '@/components/common/Skeleton';
import { DashboardAchievement } from './AchievementsGrid';
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
    onOpenMilestones?: () => void;
    showXpGuide: boolean;
    onToggleXpGuide: () => void;
}

export function LevelProgressBar({
    gamification,
    loading = false,
    onOpenMilestones,
    showXpGuide,
    onToggleXpGuide,
}: LevelProgressBarProps) {
    if (loading || !gamification) {
        return (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between">
                        <Skeleton variant="text" className="h-5 w-36" animate="wave" />
                        <Skeleton variant="rounded" className="h-5 w-20 rounded-full" animate="wave" />
                    </div>
                    <Skeleton variant="text" className="h-3.5 w-48 mt-1.5" animate="wave" />
                </div>

                <div className="my-3 space-y-3">
                    <div className="flex items-center gap-3.5">
                        <Skeleton variant="rounded" className="h-12 w-12 rounded-xl shrink-0" animate="wave" />
                        <div className="space-y-2 flex-1">
                            <Skeleton variant="text" className="h-4 w-full" animate="wave" />
                            <Skeleton variant="rounded" className="h-2 w-full rounded-full" animate="wave" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <Skeleton variant="rounded" className="h-11 w-full rounded-xl" animate="wave" />
                        <Skeleton variant="rounded" className="h-11 w-full rounded-xl" animate="wave" />
                    </div>
                </div>

                <div className="pt-2 border-t border-[var(--color-border)]">
                    <Skeleton variant="text" className="h-3.5 w-40" animate="wave" />
                </div>
            </div>
        );
    }

    const progressPercent = Math.min(100, Math.max(0, gamification.xp_progress_percent));
    const xpNeeded = Math.max(0, gamification.xp_for_next_level - gamification.xp_into_level);

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 sm:p-6 rounded-2xl shadow-sm h-full flex flex-col justify-between transition-all duration-300 hover:shadow-md">
            {/* ① Header: Title + Tier Rank Pill on a single straight line */}
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-[var(--color-text)] tracking-tight whitespace-nowrap">
                        Level &amp; Progression
                    </h2>
                    <p className="text-[var(--color-muted)] text-xs mt-0.5 truncate">
                        Tier rank and XP progress milestones.
                    </p>
                </div>
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

            {/* ② Middle: Level Badge + XP Progress Bar */}
            <div className="my-3.5 space-y-3">
                <div className="flex items-center gap-3.5">
                    {/* Level Avatar Emblem */}
                    <div className="relative shrink-0">
                        <div
                            className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-black border-2 shadow-2xs transition-transform hover:scale-105"
                            style={{
                                backgroundColor: `${gamification.tier_color}18`,
                                borderColor: `${gamification.tier_color}45`,
                                color: gamification.tier_color,
                            }}
                        >
                            L{gamification.level}
                        </div>
                        <span className="absolute -bottom-1 -right-1 text-[7px] font-black px-1 py-0.2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] uppercase tracking-wider">
                            LVL
                        </span>
                    </div>

                    {/* Progress Bar & Numbers */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-[var(--color-text)]">Level {gamification.level}</span>
                            <span className="text-[11px] font-extrabold text-[var(--color-muted)] tabular-nums">
                                {gamification.xp_into_level} / {gamification.xp_for_next_level} XP
                            </span>
                        </div>

                        {/* Fluid XP Bar */}
                        <div className="w-full bg-[var(--color-background)] border border-[var(--color-border)] h-2 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{
                                    width: `${progressPercent}%`,
                                    backgroundColor: gamification.tier_color,
                                }}
                            />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-[var(--color-muted)] mt-1 font-semibold">
                            <span>{xpNeeded > 0 ? `${xpNeeded} XP to Level ${gamification.level + 1}` : 'Max level reached'}</span>
                            <span className="font-bold" style={{ color: gamification.tier_color }}>
                                {progressPercent}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Compact Mini Metric Stats: Streak & Badges */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                        type="button"
                        onClick={onOpenMilestones}
                        className="bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-xl p-2.5 flex items-center gap-2 transition-all cursor-pointer group shadow-2xs text-left"
                        title="Click to view Streak Milestones & Roadmap"
                    >
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0 group-hover:scale-105 transition-transform">
                            <Flame className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-xs font-black text-[var(--color-text)]">
                                {gamification.current_streak} {gamification.current_streak === 1 ? 'day' : 'days'}
                            </span>
                            <span className="block text-[10px] text-[var(--color-muted)] font-semibold truncate">
                                Study Streak
                            </span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenMilestones}
                        className="bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-xl p-2.5 flex items-center gap-2 transition-all cursor-pointer group shadow-2xs text-left"
                        title="Click to view all milestone badges"
                    >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-105 transition-transform">
                            <Trophy className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-xs font-black text-[var(--color-text)]">
                                {gamification.earned_achievements} Badges
                            </span>
                            <span className="block text-[10px] text-[var(--color-muted)] font-semibold truncate">
                                Unlocked
                            </span>
                        </div>
                    </button>
                </div>
            </div>

            {/* ③ Footer link: How to earn XP (subtle, clean text button) */}
            <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between text-xs text-[var(--color-muted)]">
                <span>{gamification.total_xp.toLocaleString()} total XP earned</span>
                <button
                    type="button"
                    onClick={onToggleXpGuide}
                    className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-semibold cursor-pointer text-xs"
                >
                    <HelpCircle className="w-3.5 h-3.5 text-sky-500" />
                    <span>XP rules</span>
                    <span className="text-[10px]">→</span>
                </button>
            </div>

            {/* Portal XP Guide Modal Dialog */}
            <XpGuideModal isOpen={showXpGuide} onToggle={onToggleXpGuide} />
        </div>
    );
}
