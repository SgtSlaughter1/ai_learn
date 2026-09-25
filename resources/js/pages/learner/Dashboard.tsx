import { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { db } from '@/db/database';
import { preloadFullOfflineCurriculum, saveLocalGamification } from '@/services/OfflineService';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { LevelProgressBar, GamificationData } from '@/components/dashboard/LevelProgressBar';
import { AchievementsGrid } from '@/components/dashboard/AchievementsGrid';
import { RecentAttemptsList, DashboardAttempt } from '@/components/dashboard/RecentAttemptsList';
import { DashboardRevisionCard } from '@/components/dashboard/DashboardRevisionCard';
import 'katex/dist/katex.min.css';

const LEVEL_THRESHOLDS = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

interface DashboardStats {
    totalSubjects: number;
    questionsAttempted: number;
    questionsCorrect: number;
    averageMastery: number;
    completedTopics: number;
}

export default function LearnerDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentAttempts, setRecentAttempts] = useState<DashboardAttempt[]>([]);
    const [gamification, setGamification] = useState<GamificationData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [showXpGuide, setShowXpGuide] = useState<boolean>(false);
    const [offlineStats, setOfflineStats] = useState<DashboardStats | null>(null);
    const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
    const { isOnline } = useNetworkStatus();

    // Auto-dismiss mobile tooltips when clicking anywhere else
    useEffect(() => {
        if (!activeTooltip) return;
        const handleDocClick = () => setActiveTooltip(null);
        window.addEventListener('click', handleDocClick);
        return () => window.removeEventListener('click', handleDocClick);
    }, [activeTooltip]);

    useEffect(() => {
        let isMounted = true;

        const loadDashboard = async () => {
            if (isOnline) {
                try {
                    const [statsData, gamData] = await Promise.all([
                        fetch('/api/v1/dashboard/stats').then((res) => res.json()),
                        fetch('/api/v1/gamification/profile').then((res) => res.json()),
                    ]);

                    if (isMounted) {
                        setStats(statsData.stats);
                        setRecentAttempts(statsData.recentAttempts || []);
                        setGamification(gamData);
                        setLoading(false);
                    }

                    // Cache recent attempts, stats, and full gamification profile for offline fallback
                    if (statsData.recentAttempts) {
                        localStorage.setItem('cached_dashboard_recent_attempts', JSON.stringify(statsData.recentAttempts));
                    }
                    if (statsData.stats) {
                        localStorage.setItem('cached_dashboard_stats', JSON.stringify(statsData.stats));
                    }
                    if (gamData) {
                        localStorage.setItem('cached_dashboard_gamification', JSON.stringify(gamData));
                        saveLocalGamification({
                            id: 1,
                            user_id: 'current',
                            total_xp: gamData.total_xp,
                            level: gamData.level,
                            tier: gamData.tier || 'Newcomer',
                            current_streak: gamData.current_streak,
                            longest_streak: gamData.longest_streak,
                            last_active_date: new Date().toISOString().split('T')[0],
                            synced: true,
                        });
                    }

                    // Background preload full offline curriculum (subjects, topics, quizzes, flashcards)
                    preloadFullOfflineCurriculum();
                } catch {
                    if (isMounted) setLoading(false);
                }
            } else {
                // Offline: load from Dexie & cached server snapshots
                const [subjects, gamCache, attempts, quizzes] = await Promise.all([
                    db.subjects.toArray(),
                    db.gamification.toCollection().first(),
                    db.quizAttempts.toArray(),
                    db.quizzes.toArray(),
                ]);

                if (isMounted) {
                    let baseStats: DashboardStats = {
                        totalSubjects: subjects.length,
                        questionsAttempted: 0,
                        questionsCorrect: 0,
                        averageMastery: 0,
                        completedTopics: 0,
                    };

                    const cachedStatsStr = localStorage.getItem('cached_dashboard_stats');
                    if (cachedStatsStr) {
                        try {
                            const parsed = JSON.parse(cachedStatsStr);
                            baseStats = { ...baseStats, ...parsed };
                        } catch {}
                    }

                    // Incorporate only un-synced offline attempts completed during this offline period
                    const unsyncedAttempts = attempts.filter((a) => !a.synced);
                    if (unsyncedAttempts.length > 0) {
                        const unsyncedQuestions = unsyncedAttempts.reduce((s, a) => s + (a.total_marks || (a.answers ? a.answers.length : 0)), 0);
                        const unsyncedCorrect = unsyncedAttempts.reduce((s, a) => s + (a.score || 0), 0);
                        baseStats.questionsAttempted += unsyncedQuestions;
                        baseStats.questionsCorrect += unsyncedCorrect;
                        if (baseStats.questionsAttempted > 0) {
                            baseStats.averageMastery = Math.round((baseStats.questionsCorrect / baseStats.questionsAttempted) * 100);
                        }
                    }

                    if (subjects.length > 0) {
                        baseStats.totalSubjects = Math.max(baseStats.totalSubjects, subjects.length);
                    }

                    setOfflineStats(baseStats);

                    // Hydrate full gamification from cached online snapshot
                    let fullGamification: GamificationData | null = null;
                    const cachedGamStr = localStorage.getItem('cached_dashboard_gamification');
                    if (cachedGamStr) {
                        try {
                            fullGamification = JSON.parse(cachedGamStr);
                        } catch {}
                    }

                    if (fullGamification) {
                        // Apply any local XP progression from Dexie if higher
                        if (gamCache && gamCache.total_xp > fullGamification.total_xp) {
                            const lvl = gamCache.level || fullGamification.level;
                            const currThreshold = LEVEL_THRESHOLDS[lvl] ?? 0;
                            const nextThreshold = LEVEL_THRESHOLDS[lvl + 1] ?? (currThreshold + 100);
                            const xpIntoLevel = Math.max(0, gamCache.total_xp - currThreshold);
                            const xpForNext = nextThreshold - currThreshold;
                            const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100));

                            fullGamification = {
                                ...fullGamification,
                                total_xp: gamCache.total_xp,
                                level: lvl,
                                tier: gamCache.tier || fullGamification.tier || 'Newcomer',
                                tier_color: fullGamification.tier_color || '#94a3b8',
                                current_streak: gamCache.current_streak || fullGamification.current_streak,
                                longest_streak: Math.max(gamCache.longest_streak || 0, fullGamification.longest_streak),
                                xp_progress_percent: progressPercent,
                                xp_into_level: xpIntoLevel,
                                xp_for_next_level: xpForNext,
                                next_level: lvl + 1,
                            };
                        }
                        setGamification(fullGamification);
                    } else if (gamCache) {
                        const lvl = gamCache.level || 1;
                        const currThreshold = LEVEL_THRESHOLDS[lvl] ?? 0;
                        const nextThreshold = LEVEL_THRESHOLDS[lvl + 1] ?? (currThreshold + 100);
                        const xpIntoLevel = Math.max(0, gamCache.total_xp - currThreshold);
                        const xpForNext = nextThreshold - currThreshold;
                        const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100));

                        setGamification({
                            total_xp: gamCache.total_xp,
                            level: lvl,
                            tier: gamCache.tier || 'Newcomer',
                            tier_color: '#94a3b8',
                            current_streak: gamCache.current_streak || 0,
                            longest_streak: gamCache.longest_streak || 0,
                            xp_progress_percent: progressPercent,
                            xp_into_level: xpIntoLevel,
                            xp_for_next_level: xpForNext,
                            next_level: lvl + 1,
                            recent_xp: [],
                            achievements: [],
                            locked_achievements: [],
                            total_achievements: 0,
                            earned_achievements: 0,
                        });
                    }

                    // Merge local attempts with cached server attempts
                    let baseRecent: DashboardAttempt[] = [];
                    const cachedRecentStr = localStorage.getItem('cached_dashboard_recent_attempts');
                    if (cachedRecentStr) {
                        try {
                            baseRecent = JSON.parse(cachedRecentStr);
                        } catch {}
                    }

                    const quizTitleMap = new Map<number, string>();
                    quizzes.forEach((q) => {
                        if (q.id && q.title) quizTitleMap.set(q.id, q.title);
                    });

                    const localAttemptsFormatted: DashboardAttempt[] = attempts
                        .filter((a) => a.status === 'completed')
                        .slice(-5)
                        .reverse()
                        .map((a) => {
                            const knownTitle = a.quiz_title || quizTitleMap.get(a.quiz_id);
                            const matchingCached = baseRecent.find(
                                (b) => String(b.id) === String(a.id) || (knownTitle && b.quiz_title === knownTitle)
                            );
                            const title = knownTitle || matchingCached?.quiz_title || `Quiz Assessment #${a.quiz_id}`;

                            const finalScore =
                                matchingCached?.score !== null && matchingCached?.score !== undefined
                                    ? matchingCached.score
                                    : a.score ?? null;

                            const finalTotalMarks =
                                matchingCached?.total_marks !== null && matchingCached?.total_marks !== undefined
                                    ? matchingCached.total_marks
                                    : a.total_marks ?? null;

                            return {
                                id: String(a.id),
                                quiz_title: title,
                                status: a.status,
                                score: finalScore,
                                total_marks: finalTotalMarks,
                                completed_at: a.completed_at || matchingCached?.completed_at || null,
                            };
                        });

                    const localIds = new Set(localAttemptsFormatted.map((a) => a.id));
                    const mergedRecent = [
                        ...localAttemptsFormatted,
                        ...baseRecent.filter((a) => !localIds.has(String(a.id))),
                    ].slice(0, 5);

                    setRecentAttempts(mergedRecent);
                    setLoading(false);
                }
            }
        };

        loadDashboard();

        return () => {
            isMounted = false;
        };
    }, [isOnline]);

    const activeStats = isOnline && stats ? stats : (offlineStats || stats);
    const accuracy =
        activeStats && activeStats.questionsAttempted > 0
            ? Math.round((activeStats.questionsCorrect / activeStats.questionsAttempted) * 100)
            : (activeStats?.averageMastery ?? 0);

    const avgMasteryScore = activeStats?.averageMastery ?? 0;

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">Dashboard</h1>
                        <p className="text-[var(--color-muted)] mt-1">Track your progress and offline learning path.</p>
                        {!isOnline && (
                            <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-1 rounded-full border border-[var(--color-accent)]/20">
                                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                Offline: showing saved data
                            </span>
                        )}
                    </div>
                    <Link href="/subjects" className="btn-primary">
                        Browse Subjects
                    </Link>
                </div>
            }
        >
            <Head>
                <title>Learner Dashboard | PassPoint</title>
                <meta name="description" content="View your subject mastery progress, active study streaks, recommended practice topics, and offline quiz history on PassPoint." />
            </Head>

            <div className="space-y-8 relative">
                {/* Daily 5-Minute Spaced Repetition Hero Card */}
                {isOnline && (
                    <DashboardRevisionCard
                        onSessionCompleted={() => {
                            fetch('/api/v1/gamification/profile')
                                .then((r) => r.json())
                                .then((d) => setGamification(d))
                                .catch(() => {});
                        }}
                    />
                )}

                {/* 4 Summary Stats Cards */}
                <StatsOverview
                    loading={loading}
                    isOnline={isOnline}
                    stats={stats}
                    offlineStats={offlineStats}
                    accuracy={accuracy}
                />

                {/* Gamification Level & XP Banner */}
                {!loading && gamification && (
                    <LevelProgressBar
                        gamification={gamification}
                        activeTooltip={activeTooltip}
                        onToggleTooltip={setActiveTooltip}
                        showXpGuide={showXpGuide}
                        onToggleXpGuide={() => setShowXpGuide(!showXpGuide)}
                    />
                )}

                {/* Achievements Grid */}
                {!loading && gamification && gamification.achievements && gamification.achievements.length > 0 && (
                    <AchievementsGrid
                        achievements={gamification.achievements}
                        activeTooltip={activeTooltip}
                        onToggleTooltip={setActiveTooltip}
                    />
                )}

                {/* Mastery Circle & Recent Quiz Activity List */}
                <RecentAttemptsList
                    loading={loading}
                    isOnline={isOnline}
                    attempts={recentAttempts}
                    averageMastery={avgMasteryScore}
                />
            </div>
        </AuthenticatedLayout>
    );
}
