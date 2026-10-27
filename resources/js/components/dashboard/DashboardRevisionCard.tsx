import React, { useState, useEffect } from 'react';
import { TodayRevisionData, RevisionSessionCompleteResult, RevisionQueueItem } from '../../types/revision';
import { DailyRevisionModal } from '../revision/DailyRevisionModal';
import { GamificationData } from './LevelProgressBar';
import { db } from '@/db/database';
import { RecessPill } from './RecessPill';
import {
    Zap,
    CheckCircle2,
    ArrowRight,
    Brain,
    Flame,
    Shield,
    Trophy,
} from 'lucide-react';

interface Props {
    gamification: GamificationData | null;
    onSessionCompleted?: (result: RevisionSessionCompleteResult) => void;
    onOpenMilestones?: () => void;
}

export const DashboardRevisionCard: React.FC<Props> = ({
    gamification,
    onSessionCompleted,
    onOpenMilestones,
}) => {
    const [data, setData] = useState<TodayRevisionData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
    const [activeModalItems, setActiveModalItems] = useState<RevisionQueueItem[]>([]);
    const [hasCompletedToday, setHasCompletedToday] = useState<boolean>(false);

    const streak = gamification?.current_streak ?? 0;
    const streakStatus = gamification?.streak_status ?? (streak > 0 ? 'at_risk' : 'inactive');
    const streakTitle = gamification?.streak_title ?? (streak >= 3 ? 'Curious Thinker' : 'Beginner');
    const shields = gamification?.streak_freeze_count ?? 1;
    const isProtected = gamification?.is_protected_today ?? (hasCompletedToday || streakStatus === 'active_today');
    const nextMilestone = gamification?.next_milestone ?? {
        target_days: streak < 3 ? 3 : (streak < 7 ? 7 : 14),
        title: streak < 3 ? 'Curious Thinker' : (streak < 7 ? 'Unstoppable' : 'Exam Champion'),
        days_remaining: Math.max(0, (streak < 3 ? 3 : (streak < 7 ? 7 : 14)) - streak),
        percent: Math.min(100, Math.round((streak / (streak < 3 ? 3 : (streak < 7 ? 7 : 14))) * 100)),
    };

    useEffect(() => {
        let isMounted = true;
        fetchQueue(isMounted);
        return () => {
            isMounted = false;
        };
    }, []);

    const fetchQueue = async (isMounted = true) => {
        try {
            const res = await fetch('/api/v1/revision/today');
            const json = await res.json();
            if (json.success && json.data) {
                if (isMounted) {
                    setData(json.data);
                    setLoading(false);
                }
                return;
            }
        } catch (err) {
            console.warn('Network offline or revision endpoint unavailable, checking local Dexie topics:', err);
        }

        try {
            // Offline fallback: assemble an AI/local 15-minute mission from local topics
            const localTopics = await db.topics.toArray().catch(() => []);
            if (localTopics.length > 0) {
                const sampleTopic = localTopics[0];
                const fallbackItems: RevisionQueueItem[] = [
                    {
                        id: 1,
                        item_type: 'question',
                        question_id: 1,
                        topic_name: sampleTopic.name,
                        subject_name: 'Core Curriculum',
                        question_text: `Targeted concept check: Review core principles of ${sampleTopic.name}.`,
                        repetition_level: 1,
                        consecutive_correct: 0,
                        interval_days: 1,
                        badge: {
                            label: 'Review',
                            description: 'Offline mission',
                            color: 'primary',
                            icon: 'brain',
                        },
                        options: [
                            { id: 1, key: 'A', label: 'A', option_text: 'Core principle verified', is_correct: true },
                            { id: 2, key: 'B', label: 'B', option_text: 'Secondary concept', is_correct: false },
                            { id: 3, key: 'C', label: 'C', option_text: 'Alternative property', is_correct: false },
                            { id: 4, key: 'D', label: 'D', option_text: 'Inverse principle', is_correct: false },
                        ],
                    },
                ];
                if (isMounted) {
                    setData({
                        total_due_today: fallbackItems.length,
                        estimated_minutes: 15,
                        stats: {
                            total_in_memory: localTopics.length,
                            due_today: fallbackItems.length,
                            mastered_items: 0,
                            learning_items: fallbackItems.length,
                            retention_rate: 85,
                        },
                        items: fallbackItems,
                    });
                }
            }
        } catch (dexieErr) {
            console.warn('Dexie fallback failed:', dexieErr);
        } finally {
            if (isMounted) {
                setLoading(false);
            }
        }
    };

    const handleComplete = (result: RevisionSessionCompleteResult) => {
        setHasCompletedToday(true);
        onSessionCompleted?.(result);
        fetchQueue(true);
    };

    const startRevision = (itemsToReview: RevisionQueueItem[]) => {
        setActiveModalItems(itemsToReview);
        setShowRevisionModal(true);
    };

    if (loading) {
        return (
            <div className="rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-sm animate-pulse h-full flex flex-col justify-between min-h-[300px]">
                <div className="flex items-center justify-between">
                    <div className="h-6 bg-[var(--color-border)] rounded-md w-56" />
                    <div className="h-10 bg-[var(--color-border)] rounded-xl w-36" />
                </div>
            </div>
        );
    }

    const items = data?.items || [];
    const totalDue = items.length;

    // Extract unique topic names for clean preview pills
    const uniqueTopics = Array.from(new Set(items.map((i) => i.topic_name))).filter(Boolean);
    const displayedTopics = uniqueTopics.slice(0, 3);

    return (
        <>
            <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm transition-all duration-300 hover:shadow-md h-full flex flex-col justify-between">
                {/* Background ambient flame glow */}
                <div
                    className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-700 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]"
                />

                <div className="relative z-10 space-y-4 flex flex-col justify-between h-full">
                    {/* ① TOP BAR: Clean single-line header that never wraps awkwardly */}
                    <div className="flex items-center justify-between gap-2">
                        {/* Streak Pill */}
                        <div
                            onClick={onOpenMilestones}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer select-none hover:scale-102 ${
                                isProtected
                                    ? 'bg-[var(--color-success-10)] border-[var(--color-success)] text-[var(--color-success)]'
                                    : streak > 0
                                    ? 'bg-[var(--color-accent-10)] border-[var(--color-accent)] text-[var(--color-accent)]'
                                    : 'bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-muted)]'
                            }`}
                            title="Click to view Streak Milestones & Roadmap"
                        >
                            <Flame
                                className={`w-3.5 h-3.5 shrink-0 ${
                                    isProtected
                                        ? 'text-[var(--color-success)]'
                                        : streak > 0
                                        ? 'text-[var(--color-accent)] animate-pulse'
                                        : 'text-[var(--color-muted)]'
                                }`}
                            />
                            <span>{streak > 0 ? `${streak}d Streak` : '0d Streak'}</span>
                        </div>

                        {/* Top-Right: Recess, Shield & Roadmap */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <RecessPill />
                            <div
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)]"
                                title={`${shields} streak freeze shield available`}
                            >
                                <Shield className={`w-3.5 h-3.5 ${shields > 0 ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-muted)]'}`} />
                                <span>{shields}</span>
                            </div>

                            {onOpenMilestones && (
                                <button
                                    type="button"
                                    onClick={onOpenMilestones}
                                    aria-label="Roadmap"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                                >
                                    <Trophy className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                                    <span className="hidden sm:inline">Roadmap</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ② MAIN BODY: Mission Headline & Subtitle */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] tracking-tight leading-snug">
                                {isProtected
                                    ? `15-Minute Mission Complete! 🔥`
                                    : `Today's 15-Minute Mission`}
                            </h2>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)] shrink-0">
                                {streakTitle}
                            </span>
                        </div>

                        <p className="text-xs sm:text-sm text-[var(--color-muted)] leading-relaxed">
                            {isProtected ? (
                                <span className="inline-flex items-center gap-1.5 text-[var(--color-success)] font-medium">
                                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                                    <span>Streak secured (+10 XP claimed). Ready for extra bonus practice or browse curriculum.</span>
                                </span>
                            ) : (
                                <span>
                                    {totalDue > 0
                                        ? `${totalDue} quick questions to boost retention and keep your streak alive • ~10 mins`
                                        : `Quick spaced practice to kickstart your daily streak • ~10 mins`}
                                </span>
                            )}
                        </p>
                    </div>

                    {/* ③ TOPIC PREVIEW PILLS (Clean & compact, max 2 shown cleanly) */}
                    {displayedTopics.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1 shrink-0">
                                <Brain className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                Focus:
                            </span>
                            <span
                                className="px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] max-w-[170px] truncate"
                                title={displayedTopics[0]}
                            >
                                {displayedTopics[0]}
                            </span>
                            {displayedTopics.length > 1 && (
                                <span
                                    className="px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] max-w-[150px] truncate"
                                    title={displayedTopics[1]}
                                >
                                    {displayedTopics[1]}
                                </span>
                            )}
                            {uniqueTopics.length > 2 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                    +{uniqueTopics.length - 2}
                                </span>
                            )}
                        </div>
                    )}

                    {/* ④ FOOTER: Progress to Next Rank + Full-Width Prominent CTA */}
                    <div className="pt-3 border-t border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
                        {/* Progress to rank */}
                        <div className="flex items-center gap-2.5">
                            <div className="w-24 sm:w-28 bg-[var(--color-background)] border border-[var(--color-border)] h-2 rounded-full overflow-hidden shrink-0">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out bg-[var(--color-accent)]"
                                    style={{ width: `${nextMilestone.percent}%` }}
                                />
                            </div>
                            <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                                {nextMilestone.days_remaining === 0
                                    ? `"${nextMilestone.title}" unlocked!`
                                    : `${nextMilestone.days_remaining}d to "${nextMilestone.title}"`}
                            </span>
                        </div>

                        {/* Action CTA Button (Full width on mobile, sleek on desktop) */}
                        <div className="w-full sm:w-auto">
                            {totalDue > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => startRevision(items)}
                                    className={`w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                                        isProtected
                                            ? 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                            : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-md'
                                    }`}
                                >
                                    <Zap className="w-4 h-4 text-[var(--color-accent)] fill-current" />
                                    <span>
                                        {isProtected
                                            ? 'Bonus Practice Drill'
                                            : `Start Mission (${totalDue} Qs)`}
                                    </span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            ) : isProtected ? (
                                <a
                                    href="/subjects"
                                    className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] active:scale-98"
                                >
                                    <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
                                    <span>Goal Met · Browse Subjects</span>
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            ) : (
                                <a
                                    href="/subjects"
                                    className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-md active:scale-98"
                                >
                                    <Zap className="w-4 h-4 text-[var(--color-accent)] fill-current" />
                                    <span>Practice Now · Browse Subjects</span>
                                    <ArrowRight className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Revision Stepper Modal */}
            {showRevisionModal && activeModalItems.length > 0 && (
                <DailyRevisionModal
                    items={activeModalItems}
                    onClose={() => setShowRevisionModal(false)}
                    onSessionCompleted={handleComplete}
                />
            )}
        </>
    );
};
