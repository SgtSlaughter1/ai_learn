import React, { useState, useEffect } from 'react';
import { TodayRevisionData, RevisionSessionCompleteResult } from '../../types/revision';
import { DailyRevisionModal } from '../revision/DailyRevisionModal';
import {
    Zap,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Brain,
    ShieldCheck,
} from 'lucide-react';

interface Props {
    onSessionCompleted?: (result: RevisionSessionCompleteResult) => void;
}

export const DashboardRevisionCard: React.FC<Props> = ({ onSessionCompleted }) => {
    const [data, setData] = useState<TodayRevisionData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [hasCompletedToday, setHasCompletedToday] = useState<boolean>(false);
    const [lastResult, setLastResult] = useState<RevisionSessionCompleteResult | null>(null);

    useEffect(() => {
        fetchQueue();
    }, []);

    const fetchQueue = async () => {
        try {
            const res = await fetch('/api/v1/revision/today');
            const json = await res.json();
            if (json.success && json.data) {
                setData(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch today revision queue:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleComplete = (result: RevisionSessionCompleteResult) => {
        setHasCompletedToday(true);
        setLastResult(result);
        onSessionCompleted?.(result);
        fetchQueue();
    };

    if (loading) {
        return (
            <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xs animate-pulse flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-4 bg-[var(--color-border)] rounded-md w-48" />
                    <div className="h-3 bg-[var(--color-border)]/60 rounded-md w-72" />
                </div>
                <div className="h-10 bg-[var(--color-border)] rounded-xl w-36" />
            </div>
        );
    }

    const items = data?.items || [];
    const mistakesCount = items.filter((i) => i.badge.color === 'error').length;
    const fragileCount = items.filter((i) => i.badge.color === 'accent').length;
    const retentionCount = items.filter((i) => i.badge.color === 'success' || i.badge.color === 'primary').length;

    return (
        <>
            <div className="rounded-3xl bg-gradient-to-r from-[var(--color-primary-10)] via-[var(--color-surface)] to-[var(--color-accent-10)] border border-[var(--color-accent-20)] p-6 md:p-7 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent-10)] rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="space-y-3 max-w-xl">
                        {/* Header Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-accent)] text-white shadow-xs">
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                Today's 5-Minute AI Revision
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                <Clock className="w-3 h-3" />
                                ~{data?.estimated_minutes || 5} mins
                            </span>
                            {hasCompletedToday && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success-20)]">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Completed Today {lastResult && lastResult.bonus_xp > 0 ? `(+${lastResult.bonus_xp} XP)` : ''}
                                </span>
                            )}
                        </div>

                        {/* Title & Pedagogical Description */}
                        <div>
                            <h3 className="text-lg md:text-xl font-black text-[var(--color-text)] tracking-tight">
                                {hasCompletedToday
                                    ? "Daily Revision Completed! 🎉"
                                    : "5-Minute Daily Revision"}
                            </h3>
                            <p className="text-xs text-[var(--color-muted)] font-medium mt-1 leading-relaxed">
                                {hasCompletedToday
                                    ? "You've finished your revision for today. Great job keeping your memory fresh!"
                                    : "AIlearn selected 6 quick revision questions from your class curriculum to help you remember what you've learned."}
                            </p>
                        </div>

                        {/* Breakdown pills */}
                        {!hasCompletedToday && items.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                {mistakesCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[var(--color-error-5)] text-[var(--color-error)] border border-[var(--color-error)]/25">
                                        <AlertCircle className="w-3 h-3" />
                                        {mistakesCount} {mistakesCount === 1 ? 'Mistake to Fix' : 'Mistakes to Fix'}
                                    </span>
                                )}
                                {fragileCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]">
                                        <Zap className="w-3 h-3" />
                                        {fragileCount} Fragile {fragileCount === 1 ? 'Topic' : 'Topics'}
                                    </span>
                                )}
                                {retentionCount > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success-20)]">
                                        <ShieldCheck className="w-3 h-3" />
                                        {retentionCount} Retention {retentionCount === 1 ? 'Check' : 'Checks'}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0 flex flex-col sm:flex-row items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowModal(true)}
                            className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                                hasCompletedToday
                                    ? 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                    : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white hover:scale-102'
                            }`}
                        >
                            <Brain className="w-4 h-4" />
                            <span>{hasCompletedToday ? 'Bonus Practice (5 Qs)' : 'Start 5-Min Revision ⚡'}</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Interactive Daily Revision Modal */}
            {showModal && items.length > 0 && (
                <DailyRevisionModal
                    items={items}
                    onClose={() => setShowModal(false)}
                    onSessionCompleted={handleComplete}
                />
            )}
        </>
    );
};
