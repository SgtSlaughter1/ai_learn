import { useState, useEffect } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { LayoutDashboard } from 'lucide-react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { db } from '@/db/database';
import { preloadFullOfflineCurriculum, saveLocalGamification } from '@/services/OfflineService';
import { belongsTo, getSyncUser } from '@/services/SyncQueue';
import { SYNC_COMPLETED_EVENT } from '@/services/SyncService';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { LevelProgressBar, GamificationData } from '@/components/dashboard/LevelProgressBar';
import { OverallMasteryCard, RecentQuizActivityCard, DashboardAttempt, mergeRecentAttempts } from '@/components/dashboard/RecentAttemptsList';
import { DashboardRevisionCard } from '@/components/dashboard/DashboardRevisionCard';
import { DashboardRecessCard } from '@/components/dashboard/DashboardRecessCard';
import { MilestoneRoadmapModal } from '@/components/dashboard/MilestoneRoadmapModal';
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
    const recessEnabled = usePage<{ auth?: { user?: { recess_enabled?: boolean } | null } }>().props.auth?.user?.recess_enabled !== false;
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentAttempts, setRecentAttempts] = useState<DashboardAttempt[]>([]);
    const [gamification, setGamification] = useState<GamificationData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [showXpGuide, setShowXpGuide] = useState<boolean>(false);
    const [isMilestonesOpen, setIsMilestonesOpen] = useState<boolean>(false);
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

        // Offline, or online but the server can't be reached: Dexie & cached server snapshots
        const loadOffline = async () => {
            const [subjects, gamCache, attempts, quizzes] = await Promise.all([
                db.subjects.toArray(),
                db.gamification.toCollection().first(),
                db.quizAttempts.toArray().then((all) => {
                    const userId = getSyncUser();
                    return userId ? all.filter((a) => belongsTo(a.user_id, userId)) : all;
                }),
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
                            streak_freeze_count: gamCache.streak_freeze_count ?? fullGamification.streak_freeze_count,
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
                        streak_freeze_count: gamCache.streak_freeze_count ?? 1,
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
                        const parsed = JSON.parse(cachedRecentStr);
                        baseRecent = Array.isArray(parsed)
                            ? parsed
                            : parsed && typeof parsed === 'object'
                            ? Object.values(parsed)
                            : [];
                    } catch {}
                }

                const quizTitleMap = new Map<number, string>();
                quizzes.forEach((q) => {
                    if (q.id && q.title) quizTitleMap.set(q.id, q.title);
                });

                setRecentAttempts(mergeRecentAttempts(attempts, baseRecent, (id) => quizTitleMap.get(id)));
                setLoading(false);
            }
        };

        const loadDashboard = async () => {
            if (isOnline) {
                try {
                    const fetchJson = async (path: string) => {
                        const res = await fetch(path, { headers: { Accept: 'application/json' } });
                        if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
                        return res.json();
                    };
                    const [statsData, gamData] = await Promise.all([
                        fetchJson('/api/v1/dashboard/stats'),
                        fetchJson('/api/v1/gamification/profile'),
                    ]);

                    if (isMounted) {
                        setStats(statsData?.stats || null);
                        const rawAttempts = statsData?.recentAttempts;
                        const safeAttempts = Array.isArray(rawAttempts)
                            ? rawAttempts
                            : rawAttempts && typeof rawAttempts === 'object'
                            ? (Array.isArray((rawAttempts as any).data) ? (rawAttempts as any).data : Object.values(rawAttempts))
                            : [];
                        // Attempts made offline and not synced yet aren't on the server: keep them in view.
                        const localAttempts = await db.quizAttempts.toArray().catch(() => []);
                        const userId = getSyncUser();
                        setRecentAttempts(mergeRecentAttempts(
                            userId ? localAttempts.filter((a) => belongsTo(a.user_id, userId)) : localAttempts,
                            safeAttempts,
                            () => undefined,
                        ));
                        setGamification(gamData);
                        setLoading(false);
                    }

                    // Cache recent attempts, stats, and full gamification profile for offline fallback
                    if (statsData?.recentAttempts) {
                        localStorage.setItem('cached_dashboard_recent_attempts', JSON.stringify(statsData.recentAttempts));
                    }
                    if (statsData.stats) {
                        localStorage.setItem('cached_dashboard_stats', JSON.stringify(statsData.stats));
                    }
                    if (gamData) {
                        localStorage.setItem('cached_dashboard_gamification', JSON.stringify(gamData));
                        saveLocalGamification({
                            id: 1,
                            user_id: getSyncUser() ?? 'current',
                            total_xp: gamData.total_xp,
                            level: gamData.level,
                            tier: gamData.tier || 'Newcomer',
                            current_streak: gamData.current_streak,
                            longest_streak: gamData.longest_streak,
                            streak_freeze_count: gamData.streak_freeze_count ?? 1,
                            last_active_date: new Date().toISOString().split('T')[0],
                            synced: true,
                        });
                    }

                    // Background preload full offline curriculum (subjects, topics, quizzes, flashcards)
                    preloadFullOfflineCurriculum();
                } catch {
                    await loadOffline();
                }
            } else {
                await loadOffline();
            }
        };

        loadDashboard();
        // When a sync sent something, the server has verified it: reload scores, stats and XP.
        const onSynced = (e: Event) => {
            if ((e as CustomEvent<{ synced?: number }>).detail?.synced) loadDashboard();
        };
        window.addEventListener(SYNC_COMPLETED_EVENT, onSynced);

        return () => {
            isMounted = false;
            window.removeEventListener(SYNC_COMPLETED_EVENT, onSynced);
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
            header={<PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="Track your progress and offline learning path." />}
        >
            <Head>
                <title>Learner Dashboard | AceDrill</title>
                <meta name="description" content="View your subject mastery progress, active study streaks, recommended practice topics, and offline quiz history on AceDrill." />
            </Head>

            <div className="space-y-6 lg:space-y-8 relative">
                {/* 1. Hero Row: Today's 15-Minute Mission (Left) paired with Level & Progression (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
                    <div className="lg:col-span-7 xl:col-span-7 flex flex-col">
                        <DashboardRevisionCard
                            gamification={gamification}
                            onOpenMilestones={() => setIsMilestonesOpen(true)}
                            onSessionCompleted={() => {
                                fetch('/api/v1/gamification/profile')
                                    .then((r) => r.json())
                                    .then((d) => setGamification(d))
                                    .catch(() => {});
                            }}
                        />
                    </div>

                    <div className="lg:col-span-5 xl:col-span-5 flex flex-col">
                        <LevelProgressBar
                            gamification={gamification}
                            loading={loading}
                            onOpenMilestones={() => setIsMilestonesOpen(true)}
                            showXpGuide={showXpGuide}
                            onToggleXpGuide={() => setShowXpGuide(!showXpGuide)}
                        />
                    </div>
                </div>

                {recessEnabled && <DashboardRecessCard />}

                {/* 2. Core Stats KPI Row (Desktop: 4 columns in 1 row; Mobile: compact 2x2 cluster) */}
                <StatsOverview
                    loading={loading}
                    isOnline={isOnline}
                    stats={stats}
                    offlineStats={offlineStats}
                    accuracy={accuracy}
                />

                {/* 3. Deep Dive & Activity Row: Overall Mastery (4 cols) + Recent Quiz Activity (8 cols) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
                    <div className="lg:col-span-4 xl:col-span-4 flex flex-col">
                        <OverallMasteryCard
                            loading={loading}
                            averageMastery={avgMasteryScore}
                        />
                    </div>

                    <div className="lg:col-span-8 xl:col-span-8 flex flex-col">
                        <RecentQuizActivityCard
                            loading={loading}
                            isOnline={isOnline}
                            attempts={recentAttempts}
                        />
                    </div>
                </div>
            </div>

            {/* Streak Milestone Roadmap & Shield Vault Modal */}
            <MilestoneRoadmapModal
                isOpen={isMilestonesOpen}
                onClose={() => setIsMilestonesOpen(false)}
                gamification={gamification}
            />
        </AuthenticatedLayout>
    );
}

