import React, { useState, useEffect } from 'react';
import { TodayRevisionData, RevisionSessionCompleteResult, RevisionQueueItem } from '../../types/revision';
import { DailyRevisionModal } from '../revision/DailyRevisionModal';
import { GamificationData } from './LevelProgressBar';
import { db } from '@/db/database';
import {
    Zap,
    CheckCircle2,
    ArrowRight,
    Brain,
    Flame,
    Shield,
    Trophy,
    Target,
    Clock,
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
    const hoursLeft = gamification?.hours_remaining_today ?? 8;
    const nextMilestone = gamification?.next_milestone ?? {
        target_days: streak < 3 ? 3 : (streak < 7 ? 7 : 14),
        title: streak < 3 ? 'Curious Thinker' : (streak < 7 ? 'Unstoppable' : 'Exam Champion'),
        days_remaining: Math.max(0, (streak < 3 ? 3 : (streak < 7 ? 7 : 14)) - streak),
        percent: Math.min(100, Math.round((streak / (streak < 3 ? 3 : (streak < 7 ? 7 : 14))) * 100)),
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    const fetchQueue = async () => {
        try {
            const res = await fetch('/api/v1/revision/today');
            const json = await res.json();
            if (json.success && json.data) {
                setData(json.data);
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
        } catch {}

        setLoading(false);
    };

    const handleComplete = (result: RevisionSessionCompleteResult) => {
        setHasCompletedToday(true);
        onSessionCompleted?.(result);
        fetchQueue();
    };

    const startRevision = (itemsToReview: RevisionQueueItem[]) => {
        setActiveModalItems(itemsToReview);
        setShowRevisionModal(true);
    };

    if (loading) {
        return (
            <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xs animate-pulse space-y-3">
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
    const remainingTopicCount = uniqueTopics.length - displayedTopics.length;

    return (
        <>
            <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:p-6 shadow-sm transition-all duration-300 hover:shadow-md">
                {/* Background ambient flame glow */}
                <div
                    className="absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-700 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)]"
                />

                {/* 3-Column Layout: ① Streak Identity | ② Main Information | ③ Actions */}
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-start gap-4 md:gap-5">
                    {/* ① LEFT: Streak Identity (Flame avatar top-aligned with title) */}
                    <div className="shrink-0 self-start">
                        <div
                            className={`w-12 h-12 md:w-13 md:h-13 rounded-2xl flex flex-col items-center justify-center border shadow-xs transition-transform hover:scale-105 cursor-pointer select-none ${
                                isProtected
                                    ? 'bg-[var(--color-success-10)] border-[var(--color-success)] text-[var(--color-success)]'
                                    : 'bg-[var(--color-accent-10)] border-[var(--color-accent)] text-[var(--color-accent)]'
                            }`}
                            onClick={onOpenMilestones}
                            title="View Milestone Titles & Roadmap"
                        >
                            <Flame
                                className={`w-5 h-5 md:w-6 md:h-6 ${
                                    isProtected
                                        ? 'text-[var(--color-success)] drop-shadow-[0_0_6px_rgba(63,125,88,0.4)]'
                                        : 'text-[var(--color-accent)] drop-shadow-[0_0_8px_rgba(217,154,61,0.5)] animate-pulse'
                                }`}
                            />
                            <span className="text-[10px] font-black uppercase tracking-tight leading-none mt-0.5">
                                {streak}D
                            </span>
                        </div>
                    </div>

                    {/* ② MIDDLE: Main Information (Next 15-Minute Mission Focus) */}
                    <div className="flex flex-col space-y-2 min-w-0">
                        {/* Mission Badge + Streak Status */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)] shrink-0">
                                <Target className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                                Next 15-Minute Mission
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)] shrink-0">
                                <Trophy className="w-2.5 h-2.5 shrink-0" />
                                {streakTitle}
                            </span>
                        </div>

                        {/* Mission Title */}
                        <h2 className="text-sm md:text-base font-black text-[var(--color-text)] tracking-tight leading-tight">
                            {isProtected
                                ? `15-Minute Mission Complete! · Streak Secured (${streak} Days 🔥)`
                                : displayedTopics.length > 0
                                ? `Today's Mission: Master ${displayedTopics[0]}${displayedTopics.length > 1 ? ` & ${displayedTopics[1]}` : ''}`
                                : streak > 0
                                ? `Today's Mission: 15-Minute Spaced Retrieval Booster`
                                : `Today's Mission: Kickstart Your Learning Streak!`}
                        </h2>

                        {/* Status / Mission Explanation Subtitle */}
                        <p className="text-xs text-[var(--color-muted)] flex items-center gap-1.5 leading-normal flex-wrap">
                            {isProtected ? (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)] shrink-0" />
                                    <span>Target hit! +10 XP claimed. Ready for extra bonus practice or browse curriculum.</span>
                                </>
                            ) : (
                                <>
                                    <Clock className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 animate-pulse" />
                                    <span>
                                        AI-curated drill based on your retention curve • ~15 mins ({totalDue > 0 ? `${totalDue} Qs` : '5-10 Qs'}) • Ends in {hoursLeft}h
                                    </span>
                                </>
                            )}
                        </p>

                        {/* Topics */}
                        {displayedTopics.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider flex items-center gap-1 shrink-0">
                                    <Brain className="w-3 h-3 text-[var(--color-primary)]" />
                                    Focus:
                                </span>
                                {displayedTopics.map((topic, idx) => (
                                    <span
                                        key={idx}
                                        className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)]"
                                    >
                                        {topic}
                                    </span>
                                ))}
                                {remainingTopicCount > 0 && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                        +{remainingTopicCount} more
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Progress to next rank */}
                        <div className="flex items-center gap-2 pt-1">
                            <div className="w-24 sm:w-32 bg-[var(--color-background)] border border-[var(--color-border)] h-1.5 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out bg-[var(--color-accent)]"
                                    style={{ width: `${nextMilestone.percent}%` }}
                                />
                            </div>
                            <span className="text-[10px] font-bold text-[var(--color-muted)]">
                                {nextMilestone.days_remaining === 0
                                    ? `"${nextMilestone.title}" unlocked!`
                                    : `${nextMilestone.days_remaining}d to "${nextMilestone.title}"`}
                            </span>
                        </div>
                    </div>

                    {/* ③ RIGHT: Actions (Top meta badges + Bottom-right CTA button) */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-between self-stretch gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--color-border)]">
                        {/* Top Meta Tags: Shield + Roadmap */}
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 bg-[var(--color-background)] px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text)]">
                                <Shield className={`w-3.5 h-3.5 ${shields > 0 ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-muted)]'}`} />
                                <span>{shields > 0 ? `${shields} Shield${shields > 1 ? 's' : ''}` : '0 Shields'}</span>
                            </div>

                            {onOpenMilestones && (
                                <button
                                    type="button"
                                    onClick={onOpenMilestones}
                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-[11px] font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
                                >
                                    <Trophy className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                                    <span>Roadmap</span>
                                </button>
                            )}
                        </div>

                        {/* Primary Action Button */}
                        <button
                            type="button"
                            onClick={() => startRevision(items)}
                            disabled={totalDue === 0}
                            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 ${
                                isProtected
                                    ? 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                    : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-md'
                            }`}
                        >
                            <Zap className="w-3.5 h-3.5 text-[var(--color-accent)] fill-current" />
                            <span>
                                {isProtected
                                    ? 'Bonus 15-Min Drill'
                                    : totalDue > 0
                                    ? `Start 15-Min Mission (${totalDue} Qs)`
                                    : 'All Caught Up!'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
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
