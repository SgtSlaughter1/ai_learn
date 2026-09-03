import { Award } from 'lucide-react';

export interface DashboardAchievement {
    id?: number;
    key: string;
    name: string;
    description: string;
    icon?: string;
    xp_reward?: number;
    unlocked_at?: string;
}

interface AchievementsGridProps {
    achievements: DashboardAchievement[];
    activeTooltip: string | null;
    onToggleTooltip: (id: string | null) => void;
}

export function AchievementsGrid({
    achievements,
    activeTooltip,
    onToggleTooltip,
}: AchievementsGridProps) {
    if (!achievements || achievements.length === 0) return null;

    return (
        <div className="mt-4">
            <div className="flex items-center gap-x-2.5 gap-y-3 flex-wrap">
                <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider shrink-0">
                    Unlocked:
                </span>
                {achievements.slice(0, 5).map((ach) => {
                    const tooltipId = `ach-${ach.key}`;
                    const isOpen = activeTooltip === tooltipId;
                    return (
                        <div key={ach.key} className="relative group/ach inline-flex">
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleTooltip(isOpen ? null : tooltipId);
                                }}
                                className="badge-accent text-[10px] inline-flex items-center gap-1.5 cursor-pointer shadow-2xs hover:border-[var(--color-accent)] transition-colors select-none text-left focus:outline-none"
                            >
                                <Award className="w-3 h-3 text-amber-500 shrink-0" />
                                {ach.name}
                            </button>

                            {/* Interactive Hover & Mobile Tap Tooltip */}
                            <div
                                className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 ${
                                    isOpen ? 'flex' : 'hidden md:group-hover/ach:flex'
                                } flex-col items-center pointer-events-none z-40 w-56 max-w-[85vw]`}
                            >
                                <div className="bg-[var(--color-text)] text-[var(--color-surface)] text-[11px] p-2.5 rounded-xl shadow-xl border border-white/10 text-center leading-snug space-y-1">
                                    <div className="font-extrabold text-[var(--color-accent)] flex items-center justify-center gap-1">
                                        <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        {ach.name}
                                    </div>
                                    {ach.description && (
                                        <div className="text-[10px] text-gray-200 font-medium leading-relaxed">
                                            {ach.description}
                                        </div>
                                    )}
                                    <div className="text-[9px] font-extrabold text-emerald-400 uppercase tracking-wider pt-0.5">
                                        +{ach.xp_reward ?? 10} XP Earned
                                    </div>
                                </div>
                                <div className="w-2 h-2 bg-[var(--color-text)] transform rotate-45 -mt-1 shadow-sm" />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
