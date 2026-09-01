import { useState, useEffect } from 'react';
import { Head, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { db } from '@/db/database';
import { preloadFullOfflineCurriculum, saveLocalGamification } from '@/services/OfflineService';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { LevelProgressBar, GamificationData } from '@/components/dashboard/LevelProgressBar';
import { RecentAttemptsList, DashboardAttempt } from '@/components/dashboard/RecentAttemptsList';
import 'katex/dist/katex.min.css';

const LEVEL_THRESHOLDS = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

interface DashboardStats {
    totalSubjects: number;
    questionsAttempted: number;
    questionsCorrect: number;
    averageMastery: number;
    completedTopics: number;
}

export default function Dashboard() {
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

                    // Cache recent attempts and stats for offline fallback
                    if (statsData.recentAttempts) {
                        localStorage.setItem('cached_dashboard_recent_attempts', JSON.stringify(statsData.recentAttempts));
                    }
                    if (statsData.stats) {
                        localStorage.setItem('cached_dashboard_stats', JSON.stringify(statsData.stats));
                    }

                    // Save gamification locally for offline
                    if (gamData) {
                        saveLocalGamification({
                            user_id: 'current',
                            total_xp: gamData.total_xp,
                            level: gamData.level,
                            rank: gamData.rank || 'Newcomer',
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
                // Offline: load from Dexie & cached localStorage
                const [subjects, progress, gamCache, attempts, quizzes] = await Promise.all([
                    db.subjects.toArray(),
                    db.learnerProgress.toArray(),
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

                    if (progress.length > 0) {
                        const totalAttempted = progress.reduce((s, p) => s + (p.questions_attempted ?? 0), 0);
                        const totalCorrect = progress.reduce((s, p) => s + (p.questions_correct ?? 0), 0);
                        const masteredTopics = progress.filter((p) => (p.mastery_score ?? 0) >= 80).length;
                        const avgMastery = Math.round(progress.reduce((s, p) => s + (p.mastery_score ?? 0), 0) / progress.length);

                        baseStats.questionsAttempted = Math.max(baseStats.questionsAttempted, totalAttempted);
                        baseStats.questionsCorrect = Math.max(baseStats.questionsCorrect, totalCorrect);
                        baseStats.completedTopics = Math.max(baseStats.completedTopics, masteredTopics);
                        baseStats.averageMastery = Math.max(baseStats.averageMastery, avgMastery);
                    }

                    const localAttempted = attempts.reduce((s, a) => s + (a.total_marks || (a.answers ? a.answers.length : 0)), 0);
                    const localCorrect = attempts.reduce((s, a) => s + (a.score || 0), 0);
                    if (localAttempted > baseStats.questionsAttempted) {
                        baseStats.questionsAttempted = localAttempted;
                        baseStats.questionsCorrect = localCorrect;
                    }

                    if (baseStats.questionsAttempted > 0) {
                        baseStats.averageMastery = Math.round((baseStats.questionsCorrect / baseStats.questionsAttempted) * 100);
                    }
                    baseStats.totalSubjects = Math.max(baseStats.totalSubjects, subjects.length);

                    setOfflineStats(baseStats);

                    // Accurate offline XP & level threshold calculations
                    if (gamCache) {
                        const lvl = gamCache.level || 1;
                        const currThreshold = LEVEL_THRESHOLDS[lvl] ?? 0;
                        const nextThreshold = LEVEL_THRESHOLDS[lvl + 1] ?? (currThreshold + 100);
                        const xpIntoLevel = Math.max(0, gamCache.total_xp - currThreshold);
                        const xpForNext = nextThreshold - currThreshold;
                        const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpForNext) * 100));

                        setGamification({
                            total_xp: gamCache.total_xp,
                            level: lvl,
                            rank: gamCache.rank || 'Newcomer',
                            rank_color: '#94a3b8',
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

                    // Merge local attempts with cached server attempts so titles never show as "Quiz #1"
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
                                Offline — showing cached data
                            </span>
                        )}
                    </div>
                    <Link href="/subjects" className="btn-primary">
                        Browse Subjects
                    </Link>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="space-y-8 relative">
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
