import React from 'react';
import { createPortal } from 'react-dom';
import {
    Flame,
    Shield,
    Trophy,
    CheckCircle2,
    X,
    AlertTriangle,
    Check,
} from 'lucide-react';
import { GamificationData } from './LevelProgressBar';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    gamification: GamificationData | null;
}

const MILESTONES = [
    { days: 3, title: 'Curious Thinker', icon: '🥉', reward: '+5 XP Bonus' },
    { days: 7, title: 'Unstoppable', icon: '🥈', reward: '+1 Freeze Shield 🛡️ & +25 XP' },
    { days: 14, title: 'Exam Champion', icon: '🥇', reward: '+1 Freeze Shield 🛡️ & +50 XP' },
    { days: 30, title: 'Master Scholar', icon: '👑', reward: '+100 XP & Legendary Status' },
];

export const MilestoneRoadmapModal: React.FC<Props> = ({
    isOpen,
    onClose,
    gamification,
}) => {
    if (!isOpen) return null;

    const streak = gamification?.current_streak ?? 0;
    const title = gamification?.streak_title ?? (streak >= 3 ? 'Curious Thinker' : 'Beginner');
    const shields = gamification?.streak_freeze_count ?? 1;
    const isProtected = gamification?.is_protected_today ?? false;

    const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const currentDayIndex = (new Date().getDay() + 6) % 7; // Monday = 0

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[var(--color-overlay)] backdrop-blur-sm animate-fade-in">
            <div
                className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl text-[var(--color-text)] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="relative p-6 border-b border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary-5)] via-[var(--color-accent-5)] to-transparent">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 p-2 rounded-xl text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-accent)] shadow-lg shadow-[var(--color-primary-20)]">
                            <Flame className="w-8 h-8 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl font-black tracking-tight text-[var(--color-text)]">
                                    {streak > 0 ? `${streak}-Day Streak` : 'Streak Hub'}
                                </h2>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]">
                                    <Trophy className="w-3 h-3" />
                                    {title}
                                </span>
                            </div>
                            <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                {isProtected
                                    ? '🔥 Streak protected for today! Complete daily memory boost to keep momentum.'
                                    : '⚠️ Complete today’s memory boost to keep your streak alive!'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Milestone Roadmap List */}
                <div className="p-6 space-y-6 flex-1">
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-[var(--color-text)]">Milestone Titles & Rewards</h3>
                        <p className="text-xs text-[var(--color-muted)]">
                            Maintain your daily practice streak to unlock prestigious titles and earn Freeze Shields!
                        </p>
                    </div>

                    <div className="space-y-3">
                        {MILESTONES.map((m) => {
                            const isUnlocked = streak >= m.days;
                            return (
                                <div
                                    key={m.days}
                                    className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
                                        isUnlocked
                                            ? 'bg-[var(--color-accent-10)] border-[var(--color-accent)] text-[var(--color-text)]'
                                            : 'bg-[var(--color-background)] border-[var(--color-border)] opacity-70'
                                    }`}
                                >
                                    <div className="flex items-center gap-3.5">
                                        <div className="text-2xl">{m.icon}</div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-extrabold text-sm">{m.title}</h4>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                                    {m.days} Days
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--color-muted)] mt-0.5">{m.reward}</p>
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        {isUnlocked ? (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success)] flex items-center gap-1">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Unlocked
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold text-[var(--color-muted)]">
                                                {m.days - streak} days away
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Streak Freeze Shield Rules */}
                    <div className="p-4 rounded-2xl bg-[var(--color-primary-10)] border border-[var(--color-primary)] flex items-start gap-3.5">
                        <Shield className="w-6 h-6 text-[var(--color-primary-light)] shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-[var(--color-text)]">
                                Freeze Shields Armed: {shields} / 2
                            </h4>
                            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                Shields auto-deploy if you miss a calendar day. If no shield is available, a small -15 XP penalty is applied to maintain healthy habit stakes.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer 7-Day Tracker */}
                <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-background)]/50 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                        Weekly Streak Progress
                    </span>
                    <div className="flex items-center gap-2">
                        {daysOfWeek.map((day, idx) => {
                            const isToday = idx === currentDayIndex;
                            const isDone = idx < currentDayIndex || (isToday && isProtected);
                            return (
                                <div key={idx} className="flex flex-col items-center gap-1">
                                    <div
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                                            isDone
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-xs'
                                                : isToday
                                                ? 'border-[var(--color-accent)] border-dashed text-[var(--color-accent)] animate-pulse'
                                                : 'border-[var(--color-border)] text-[var(--color-muted)]'
                                        }`}
                                    >
                                        {isDone ? <Check className="w-3 h-3" /> : day}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
