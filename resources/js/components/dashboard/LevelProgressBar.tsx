import { Flame, Trophy } from 'lucide-react';
import { AchievementsGrid, DashboardAchievement } from './AchievementsGrid';
import { XpGuideModal } from './XpGuideModal';

export interface GamificationData {
    total_xp: number;
    level: number;
    rank: string;
    rank_color: string;
    current_streak: number;
    longest_streak: number;
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
    gamification: GamificationData;
    activeTooltip: string | null;
    onToggleTooltip: (id: string | null) => void;
    showXpGuide: boolean;
    onToggleXpGuide: () => void;
}

export function LevelProgressBar({
    gamification,
    activeTooltip,
    onToggleTooltip,
    showXpGuide,
    onToggleXpGuide,
}: LevelProgressBarProps) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 md:p-8 rounded-3xl shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="relative">
                        <div
                            className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-black border-2 shadow-lg"
                            style={{
                                backgroundColor: `${gamification.rank_color}15`,
                                borderColor: `${gamification.rank_color}40`,
                                color: gamification.rank_color,
                            }}
                        >
                            L{gamification.level}
                        </div>
                        <span className="absolute -bottom-1 -right-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] uppercase tracking-wider">
                            Lvl
                        </span>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold" style={{ color: gamification.rank_color }}>
                                {gamification.rank}
                            </span>
                            <span className="text-xs text-[var(--color-muted)]">•</span>
                            <span className="text-xs text-[var(--color-muted)] font-semibold">
                                Level {gamification.level}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-40 md:w-56 bg-[var(--color-background)] border border-[var(--color-border)] h-3 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${gamification.xp_progress_percent}%`,
                                        backgroundColor: gamification.rank_color,
                                    }}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--color-muted)] whitespace-nowrap">
                                {gamification.xp_into_level}/{gamification.xp_for_next_level} XP
                            </span>
                        </div>
                        <span className="text-xs text-[var(--color-muted)] font-semibold">
                            {gamification.total_xp.toLocaleString()} total XP earned
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                            <Flame className="w-5 h-5 text-amber-500 shrink-0" />
                            <span className="text-2xl font-black text-[var(--color-accent)]">
                                {gamification.current_streak}
                            </span>
                        </div>
                        <span className="text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">
                            Day Streak
                        </span>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                            <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                            <span className="text-2xl font-black text-[var(--color-accent)]">
                                {gamification.earned_achievements}
                            </span>
                        </div>
                        <span className="text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">
                            Badges
                        </span>
                    </div>
                </div>
            </div>

            {/* Recent XP chips */}
            {gamification.recent_xp.length > 0 && (
                <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
                    <div className="flex items-center gap-x-2.5 gap-y-3 flex-wrap">
                        <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider shrink-0">
                            Recent XP:
                        </span>
                        {gamification.recent_xp.slice(0, 4).map((xp, idx) => {
                            const tooltipId = `xp-${idx}`;
                            const isOpen = activeTooltip === tooltipId;
                            return (
                                <div key={idx} className="relative group/xp inline-flex">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onToggleTooltip(isOpen ? null : tooltipId);
                                        }}
                                        className="badge-success text-[10px] shadow-2xs hover:border-[var(--color-success)] transition-colors cursor-pointer select-none text-left focus:outline-none"
                                    >
                                        +{xp.amount} XP • {xp.description || xp.source.replace('_', ' ')}
                                    </button>
                                    <div
                                        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${
                                            isOpen ? 'flex' : 'hidden md:group-hover/xp:flex'
                                        } flex-col items-center pointer-events-none z-40 w-48 max-w-[85vw]`}
                                    >
                                        <div className="bg-[var(--color-text)] text-[var(--color-surface)] text-[10px] p-2 rounded-xl shadow-xl border border-white/10 text-center font-medium leading-snug">
                                            <span className="font-bold text-emerald-400">+{xp.amount} XP Earned</span>
                                            <span className="block text-gray-200 text-[9px] mt-0.5 capitalize">
                                                {xp.description || xp.source.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="w-2 h-2 bg-[var(--color-text)] transform rotate-45 -mt-1 shadow-sm" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Achievements */}
            <AchievementsGrid
                achievements={gamification.achievements}
                activeTooltip={activeTooltip}
                onToggleTooltip={onToggleTooltip}
            />

            {/* XP Guide */}
            <XpGuideModal isOpen={showXpGuide} onToggle={onToggleXpGuide} />
        </div>
    );
}
