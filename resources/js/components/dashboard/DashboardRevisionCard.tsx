import React, { useState, useEffect, useMemo } from 'react';
import { TodayRevisionData, RevisionSessionCompleteResult, RevisionQueueItem } from '../../types/revision';
import { DailyRevisionModal } from '../revision/DailyRevisionModal';
import {
    Zap,
    Clock,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Brain,
    ShieldCheck,
    Target,
    Sparkles,
    Check,
    Search,
    X,
    Layers,
    ChevronRight,
} from 'lucide-react';

interface Props {
    onSessionCompleted?: (result: RevisionSessionCompleteResult) => void;
}

interface TopicRevisionGroup {
    key: string;
    subjectName: string;
    topicName: string;
    items: RevisionQueueItem[];
    reasonType: 'weak_topic' | 'recent_mistake' | 'fragile_mastery' | 'retention_check' | 'general';
    badgeLabel: string;
    why: string;
    badgeColorClass: string;
    icon: React.ReactNode;
    xpReward: number;
}

const PREVIEW_LIMIT = 3;

export const DashboardRevisionCard: React.FC<Props> = ({ onSessionCompleted }) => {
    const [data, setData] = useState<TodayRevisionData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [showRevisionModal, setShowRevisionModal] = useState<boolean>(false);
    const [showAllTopicsModal, setShowAllTopicsModal] = useState<boolean>(false);
    const [activeModalItems, setActiveModalItems] = useState<RevisionQueueItem[]>([]);
    const [hasCompletedToday, setHasCompletedToday] = useState<boolean>(false);
    const [lastResult, setLastResult] = useState<RevisionSessionCompleteResult | null>(null);

    // Filter & Search inside "View All" modal
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeFilter, setActiveFilter] = useState<string>('all');

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

    const startRevision = (itemsToReview: RevisionQueueItem[]) => {
        setActiveModalItems(itemsToReview);
        setShowAllTopicsModal(false);
        setShowRevisionModal(true);
    };

    // Group queue items by topic and build concise reasons
    const topicGroups: TopicRevisionGroup[] = useMemo(() => {
        if (!data?.items || data.items.length === 0) return [];

        const map = new Map<string, RevisionQueueItem[]>();
        data.items.forEach((item) => {
            const groupKey = `${item.subject_name}:::${item.topic_name}`;
            if (!map.has(groupKey)) {
                map.set(groupKey, []);
            }
            map.get(groupKey)!.push(item);
        });

        const groups: TopicRevisionGroup[] = [];
        map.forEach((items, key) => {
            const [subjectName, topicName] = key.split(':::');
            
            const hasMistake = items.some((i) => i.badge?.color === 'error' || i.badge?.label?.toLowerCase().includes('mistake'));
            const isWeakTopic = items.some((i) => i.badge?.color === 'primary' && (i.badge?.label?.toLowerCase().includes('topic') || i.badge?.description?.toLowerCase().includes('lowest')));
            const isFragile = items.some((i) => i.badge?.color === 'accent' || i.badge?.label?.toLowerCase().includes('recall'));
            const isRetention = items.some((i) => i.badge?.color === 'success' || i.badge?.label?.toLowerCase().includes('retention') || i.badge?.label?.toLowerCase().includes('check'));

            let reasonType: TopicRevisionGroup['reasonType'] = 'general';
            let badgeLabel = 'Daily Recall';
            let why = 'Quick active recall warmup to maintain solid understanding.';
            let badgeColorClass = 'text-[var(--color-primary)] bg-[var(--color-primary-10)] border-[var(--color-primary-20)]';
            let icon = <Brain className="w-3 h-3 text-[var(--color-primary)]" />;

            if (hasMistake) {
                reasonType = 'recent_mistake';
                badgeLabel = 'Recent Mistake';
                why = 'Review missed questions to fix misconceptions before they become habits.';
                badgeColorClass = 'text-rose-500 bg-rose-500/10 border-rose-500/20';
                icon = <AlertCircle className="w-3 h-3 text-rose-500" />;
            } else if (isWeakTopic) {
                reasonType = 'weak_topic';
                badgeLabel = 'Targeted Boost';
                why = 'Teacher-targeted practice to reinforce fundamentals and boost your mastery score.';
                badgeColorClass = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
                icon = <Target className="w-3 h-3 text-amber-500" />;
            } else if (isFragile) {
                reasonType = 'fragile_mastery';
                badgeLabel = 'Memory Decay';
                why = 'Concept is entering the forgetting zone. A 2-minute review keeps it fresh.';
                badgeColorClass = 'text-sky-500 bg-sky-500/10 border-sky-500/20';
                icon = <Zap className="w-3 h-3 text-sky-500" />;
            } else if (isRetention) {
                reasonType = 'retention_check';
                badgeLabel = 'Mastery Lock';
                why = 'Final retention check to confirm this topic is locked into permanent memory.';
                badgeColorClass = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
                icon = <ShieldCheck className="w-3 h-3 text-emerald-500" />;
            }

            const xpReward = items.length * 5 + 5;

            groups.push({
                key,
                subjectName,
                topicName,
                items,
                reasonType,
                badgeLabel,
                why,
                badgeColorClass,
                icon,
                xpReward,
            });
        });

        // Priority sort: mistakes -> weak topics -> memory decay -> retention -> general
        const priorityOrder: Record<string, number> = {
            recent_mistake: 1,
            weak_topic: 2,
            fragile_mastery: 3,
            retention_check: 4,
            general: 5,
        };

        return groups.sort((a, b) => (priorityOrder[a.reasonType] || 99) - (priorityOrder[b.reasonType] || 99));
    }, [data]);

    // Filtered list for "View All" modal
    const filteredTopicGroups = useMemo(() => {
        return topicGroups.filter((g) => {
            const matchesSearch =
                searchQuery.trim() === '' ||
                g.topicName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                g.badgeLabel.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesFilter =
                activeFilter === 'all' ||
                (activeFilter === 'mistakes' && g.reasonType === 'recent_mistake') ||
                (activeFilter === 'targeted' && g.reasonType === 'weak_topic') ||
                (activeFilter === 'decay' && g.reasonType === 'fragile_mastery') ||
                (activeFilter === 'retention' && g.reasonType === 'retention_check');

            return matchesSearch && matchesFilter;
        });
    }, [topicGroups, searchQuery, activeFilter]);

    if (loading) {
        return (
            <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-6 shadow-xs animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                    <div className="h-5 bg-[var(--color-border)] rounded-md w-48" />
                    <div className="h-9 bg-[var(--color-border)] rounded-xl w-32" />
                </div>
                <div className="space-y-2">
                    <div className="h-14 bg-[var(--color-surface-hover)] rounded-xl" />
                    <div className="h-14 bg-[var(--color-surface-hover)] rounded-xl" />
                </div>
            </div>
        );
    }

    const items = data?.items || [];
    const totalDue = items.length;
    const totalTopicsCount = topicGroups.length;
    const previewTopics = topicGroups.slice(0, PREVIEW_LIMIT);
    const hasMore = totalTopicsCount > PREVIEW_LIMIT;

    return (
        <>
            <div className="rounded-3xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 md:p-6 shadow-sm space-y-4 relative overflow-hidden">
                {/* Section Header */}
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--color-primary)] text-white shadow-xs">
                                <Brain className="w-3 h-3 fill-current" />
                                Smart Revision
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                <Layers className="w-3 h-3 text-[var(--color-primary)]" />
                                {totalTopicsCount} {totalTopicsCount === 1 ? 'Topic' : 'Topics'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)]">
                                <Clock className="w-3 h-3 text-[var(--color-primary)]" />
                                ~{data?.estimated_minutes || 5} min
                            </span>
                            {hasCompletedToday && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Done Today {lastResult && lastResult.bonus_xp > 0 ? `(+${lastResult.bonus_xp} XP)` : ''}
                                </span>
                            )}
                        </div>

                        <h2 className="text-lg md:text-xl font-black text-[var(--color-text)] tracking-tight flex items-center gap-2">
                            <span>Topics Ready for Memory Boost</span>
                            <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
                        </h2>
                    </div>

                    {/* Header Action Buttons */}
                    {totalDue > 0 && (
                        <div className="shrink-0 flex items-center gap-2">
                            {hasMore && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllTopicsModal(true)}
                                    className="px-3.5 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text)] transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Layers className="w-3.5 h-3.5 text-[var(--color-muted)]" />
                                    <span>All ({totalTopicsCount})</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => startRevision(items)}
                                className={`px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                                    hasCompletedToday
                                        ? 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                        : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white hover:scale-101'
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                <span>{hasCompletedToday ? 'Bonus Review' : `Revise All (${totalDue} Qs)`}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Streamlined, Compact Priority Topics List */}
                {totalTopicsCount > 0 ? (
                    <div className="space-y-2.5 relative z-10">
                        {previewTopics.map((group) => (
                            <div
                                key={group.key}
                                className="group relative bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 rounded-2xl p-3.5 md:p-4 transition-all hover:shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                                {/* Left Content: Single-row header & clear why */}
                                <div className="space-y-1 min-w-0 max-w-2xl">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-0.5 rounded-md">
                                            {group.subjectName}
                                        </span>
                                        <h3 className="text-sm font-black text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                                            {group.topicName}
                                        </h3>
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${group.badgeColorClass}`}>
                                            {group.icon}
                                            <span>{group.badgeLabel}</span>
                                        </span>
                                    </div>

                                    <p className="text-xs text-[var(--color-muted)] font-medium">
                                        {group.why}
                                    </p>
                                </div>

                                {/* Right Stats & CTA */}
                                <div className="shrink-0 flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--color-border)]/50">
                                    <span className="text-[11px] font-bold text-[var(--color-muted)] whitespace-nowrap">
                                        {group.items.length} {group.items.length === 1 ? 'Q' : 'Qs'} &bull; <span className="text-amber-500">+{group.xpReward} XP</span>
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => startRevision(group.items)}
                                        className="px-3.5 py-1.5 rounded-xl bg-[var(--color-surface)] hover:bg-[var(--color-primary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-primary)] text-xs font-bold text-[var(--color-text)] transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                        <span>Revise</span>
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* View More Bar if > PREVIEW_LIMIT topics */}
                        {hasMore && (
                            <button
                                type="button"
                                onClick={() => setShowAllTopicsModal(true)}
                                className="w-full py-2.5 px-4 rounded-xl bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-primary)] transition-all flex items-center justify-center gap-1.5 cursor-pointer group"
                            >
                                <span>View all {totalTopicsCount} topics needing revision</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        )}
                    </div>
                ) : (
                    /* Zero State: All caught up! */
                    <div className="relative z-10 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] p-5 text-center space-y-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                            <Check className="w-5 h-5 stroke-[3]" />
                        </div>
                        <div className="max-w-md mx-auto">
                            <h3 className="text-sm font-black text-[var(--color-text)]">
                                All Topics Fully Reinforced! 🎉
                            </h3>
                            <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                No urgent memory decay or weak topic revisions due today. Great job keeping your memory sharp!
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* FULL "VIEW ALL TOPICS" MODAL */}
            {showAllTopicsModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] max-w-3xl w-full rounded-3xl p-5 md:p-6 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between gap-4 pb-2 border-b border-[var(--color-border)]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-black text-[var(--color-text)]">
                                        All Revision Topics ({totalTopicsCount})
                                    </h3>
                                    <span className="text-xs font-bold bg-[var(--color-primary-10)] text-[var(--color-primary)] px-2.5 py-0.5 rounded-full">
                                        {totalDue} Questions
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                    Choose any topic to practice or revise all at once.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowAllTopicsModal(false)}
                                className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Filter Controls */}
                        <div className="space-y-2.5">
                            <div className="relative">
                                <Search className="w-4 h-4 text-[var(--color-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    placeholder="Search by topic or subject..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:outline-hidden focus:border-[var(--color-primary)] transition-all"
                                />
                            </div>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                        activeFilter === 'all'
                                            ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                            : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    All ({topicGroups.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('mistakes')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                        activeFilter === 'mistakes'
                                            ? 'bg-rose-500 text-white shadow-xs'
                                            : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    Mistakes ({topicGroups.filter((g) => g.reasonType === 'recent_mistake').length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('targeted')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                        activeFilter === 'targeted'
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    Targeted ({topicGroups.filter((g) => g.reasonType === 'weak_topic').length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('decay')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                        activeFilter === 'decay'
                                            ? 'bg-sky-500 text-white shadow-xs'
                                            : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    Memory Decay ({topicGroups.filter((g) => g.reasonType === 'fragile_mastery').length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveFilter('retention')}
                                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                        activeFilter === 'retention'
                                            ? 'bg-emerald-500 text-white shadow-xs'
                                            : 'bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                    }`}
                                >
                                    Mastery ({topicGroups.filter((g) => g.reasonType === 'retention_check').length})
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Topics List */}
                        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {filteredTopicGroups.length > 0 ? (
                                filteredTopicGroups.map((group) => (
                                    <div
                                        key={group.key}
                                        className="group bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 rounded-xl p-3 transition-all hover:shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                    >
                                        <div className="space-y-1 min-w-0 max-w-xl">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--color-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 rounded">
                                                    {group.subjectName}
                                                </span>
                                                <h4 className="text-xs font-black text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                                                    {group.topicName}
                                                </h4>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${group.badgeColorClass}`}>
                                                    {group.icon}
                                                    <span>{group.badgeLabel}</span>
                                                </span>
                                            </div>

                                            <p className="text-[11px] text-[var(--color-muted)] font-medium">
                                                {group.why}
                                            </p>
                                        </div>

                                        <div className="shrink-0 flex items-center justify-between sm:justify-end gap-2.5 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-[var(--color-border)]/50">
                                            <span className="text-[11px] font-bold text-[var(--color-muted)] whitespace-nowrap">
                                                {group.items.length} {group.items.length === 1 ? 'Q' : 'Qs'} &bull; <span className="text-amber-500">+{group.xpReward} XP</span>
                                            </span>

                                            <button
                                                type="button"
                                                onClick={() => startRevision(group.items)}
                                                className="px-3 py-1 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary-hover)] transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                                            >
                                                <span>Revise</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center text-[var(--color-muted)] text-xs">
                                    No topics found matching your filter or search query.
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-2.5 border-t border-[var(--color-border)] flex items-center justify-between gap-3">
                            <span className="text-xs text-[var(--color-muted)] font-medium">
                                {filteredTopicGroups.length} of {totalTopicsCount} topics shown
                            </span>
                            <button
                                type="button"
                                onClick={() => startRevision(items)}
                                className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary-hover)] transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                            >
                                <Zap className="w-3.5 h-3.5 fill-current" />
                                <span>Revise All ({totalDue} Qs)</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Interactive Daily Revision Modal */}
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
