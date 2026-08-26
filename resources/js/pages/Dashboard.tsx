import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { db } from '@/db/database';
import 'katex/dist/katex.min.css';

interface Attempt {
    id: string;
    quiz_title: string;
    status: string;
    score: number | null;
    total_marks: number | null;
    completed_at: string | null;
}

interface Stats {
    totalSubjects: number;
    questionsAttempted: number;
    questionsCorrect: number;
    averageMastery: number;
    completedTopics: number;
}

interface GamificationProfile {
    total_xp: number;
    level: number;
    rank: string;
    rank_color: string;
    current_streak: number;
    longest_streak: number;
    xp_progress_percent: number;
    xp_into_level: number;
    xp_for_next_level: number;
    next_level: number | null;
    recent_xp: { amount: number; source: string; description: string | null; created_at: string }[];
    achievements: { key: string; name: string; description: string | null; icon: string; earned_at: string }[];
    locked_achievements: { key: string; name: string; description: string | null; icon: string }[];
    total_achievements: number;
    earned_achievements: number;
}

export default function Dashboard() {
    const [loading, setLoading] = useState<boolean>(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentAttempts, setRecentAttempts] = useState<Attempt[]>([]);
    const [gamification, setGamification] = useState<GamificationProfile | null>(null);
    const [showXpGuide, setShowXpGuide] = useState<boolean>(false);
    const [offlineStats, setOfflineStats] = useState<any>(null);
    const isOnline = useNetworkStatus();

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
                        setRecentAttempts(statsData.recentAttempts);
                        setGamification(gamData);
                        setLoading(false);
                    }

                    // Background preload and sync all subjects into Dexie for offline readiness
                    fetch('/api/v1/subjects')
                        .then((r) => (r.ok ? r.json() : null))
                        .then((d) => {
                            if (d?.subjects?.length) {
                                db.subjects.bulkPut(
                                    d.subjects.map((s: any) => ({
                                        id: s.id,
                                        name: s.name,
                                        slug: s.slug,
                                        description: s.description,
                                        status: 'published',
                                        sort_order: 0,
                                        progress_percent: s.progress_percent || 0,
                                        topics_count: s.topics_count || 0,
                                        cached_at: new Date().toISOString(),
                                    }))
                                );
                            }
                        })
                        .catch(() => {});
                } catch {
                    if (isMounted) setLoading(false);
                }
            } else {
                // Offline: load from Dexie
                const cached = await db.learnerProgress.toArray();
                const gamCache = await db.gamification.toCollection().first();
                const attempts = await db.quizAttempts.toArray();
                if (isMounted) {
                    if (cached.length > 0) {
                        const total = cached.length;
                        const mastered = cached.filter(c => (c.mastery_score ?? 0) >= 80).length;
                        const avgMastery = total > 0
                            ? Math.round(cached.reduce((s, c) => s + (c.mastery_score ?? 0), 0) / total)
                            : 0;
                        setOfflineStats({ total, mastered, avgMastery });
                    }
                    if (gamCache) {
                        setGamification(gamCache as unknown as GamificationProfile);
                    }
                    setRecentAttempts(
                        attempts.slice(-5).reverse().map(a => ({
                            id: String(a.id),
                            quiz_title: 'Quiz #' + a.quiz_id,
                            status: a.status,
                            score: a.score ?? null,
                            total_marks: a.total_marks ?? null,
                            completed_at: a.completed_at || null,
                        }))
                    );
                    setLoading(false);
                }
            }
        };

        loadDashboard();
        return () => { isMounted = false; };
    }, [isOnline]);

    const accuracy = stats && stats.questionsAttempted > 0
        ? Math.round((stats.questionsCorrect / stats.questionsAttempted) * 100)
        : 0;

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
                    <Link
                        href="/subjects"
                        className="btn-primary"
                    >
                        Browse Subjects
                    </Link>
                </div>
            }
        >
            <Head title="Dashboard" />

            <div className="space-y-8 relative">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label="Active Subjects"
                        value={loading ? '...' : isOnline ? stats?.totalSubjects : offlineStats?.total ?? 0}
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13M12 19.247V21" /></svg>}
                        loading={loading}
                    />
                    <StatCard
                        label="Questions Solved"
                        value={loading ? '...' : isOnline ? stats?.questionsAttempted : offlineStats?.total ?? 0}
                        subtitle={stats ? `${stats.questionsCorrect} correct answers` : undefined}
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                        loading={loading}
                    />
                    <StatCard
                        label="Avg. Accuracy"
                        value={loading ? '...' : `${isOnline ? accuracy : offlineStats?.avgMastery ?? 0}%`}
                        subtitle="Based on quiz attempts"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                        loading={loading}
                    />
                    <StatCard
                        label="Mastered Topics"
                        value={loading ? '...' : isOnline ? stats?.completedTopics : offlineStats?.mastered ?? 0}
                        subtitle=">= 80% mastery level"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                        loading={loading}
                    />
                </div>

                {/* Gamification Banner */}
                {!loading && gamification && (
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
                                        <span className="text-sm font-extrabold" style={{ color: gamification.rank_color }}>{gamification.rank}</span>
                                        <span className="text-xs text-[var(--color-muted)]">•</span>
                                        <span className="text-xs text-[var(--color-muted)] font-semibold">Level {gamification.level}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-40 md:w-56 bg-[var(--color-background)] border border-[var(--color-border)] h-3 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700 ease-out"
                                                style={{ width: `${gamification.xp_progress_percent}%`, backgroundColor: gamification.rank_color }}
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
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-2xl">🔥</span>
                                        <span className="text-2xl font-black text-[var(--color-accent)]">{gamification.current_streak}</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">Day Streak</span>
                                </div>
                                <div className="text-center">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-2xl">🏆</span>
                                        <span className="text-2xl font-black text-[var(--color-accent)]">{gamification.earned_achievements}</span>
                                    </div>
                                    <span className="text-[10px] text-[var(--color-muted)] font-bold uppercase tracking-wider">
                                        / {gamification.total_achievements}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {gamification.recent_xp.length > 0 && (
                            <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Recent XP:</span>
                                    {gamification.recent_xp.slice(0, 4).map((xp, idx) => (
                                        <span key={idx} className="badge-success text-[10px]">
                                            +{xp.amount} XP • {xp.description || xp.source.replace('_', ' ')}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {gamification.achievements.length > 0 && (
                            <div className="mt-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">Unlocked:</span>
                                    {gamification.achievements.slice(0, 5).map((ach) => (
                                        <span key={ach.key} className="badge-accent text-[10px]" title={ach.description || ''}>
                                            {ach.icon} {ach.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                            <button
                                onClick={() => setShowXpGuide(!showXpGuide)}
                                className="flex items-center gap-2 text-[10px] font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                <svg className={`w-3 h-3 transition-transform ${showXpGuide ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                                How to Earn XP
                            </button>

                            {showXpGuide && (
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {[
                                        { icon: '✅', label: 'Correct Answer', xp: '+10 XP', desc: 'Every right answer in any quiz' },
                                        { icon: '📝', label: 'Quiz Complete', xp: '+25 XP', desc: 'Finish any quiz attempt' },
                                        { icon: '💎', label: 'Perfect Score', xp: '+50 XP', desc: 'Get 100% on any quiz' },
                                        { icon: '🆕', label: 'First Attempt', xp: '+20 XP', desc: 'Try a quiz for the first time' },
                                        { icon: '🔥', label: 'Daily Streak', xp: '+15+ XP', desc: 'Every 7 days you study in a row' },
                                        { icon: '🏆', label: 'Achievement', xp: '+25 XP', desc: 'Unlock any badge or milestone' },
                                    ].map((item) => (
                                        <div key={item.label} className="flex items-start gap-3 p-3 bg-[var(--color-primary)]/5 border border-[var(--color-border)] rounded-xl">
                                            <div className="h-8 w-8 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 flex items-center justify-center shrink-0">
                                                <span className="text-sm">{item.icon}</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-xs font-bold text-[var(--color-text)]">{item.label}</span>
                                                    <span className="badge-success text-[9px]">{item.xp}</span>
                                                </div>
                                                <p className="text-[10px] text-[var(--color-muted)] mt-0.5">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Progress Overview Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Mastery Level Circular Indicator */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl lg:col-span-1 flex flex-col justify-between min-h-[320px] shadow-sm">
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text)]">Overall Mastery</h2>
                            <p className="text-[var(--color-muted)] text-xs mt-1">Average topic understanding score.</p>
                        </div>
                        <div className="my-8 flex justify-center items-center">
                            {loading ? (
                                <div className="h-40 w-40 rounded-full bg-[var(--color-background)] border border-[var(--color-border)] flex items-center justify-center animate-pulse">
                                    <div className="h-32 w-32 rounded-full bg-[var(--color-surface)]" />
                                </div>
                            ) : (
                                <div className="relative h-40 w-40 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" stroke="var(--color-border)" strokeWidth="8" fill="transparent" />
                                        <circle
                                            cx="50" cy="50" r="40"
                                            stroke="var(--color-primary)" strokeWidth="8" fill="transparent"
                                            strokeDasharray="251.2"
                                            strokeDashoffset={251.2 - (251.2 * (stats?.averageMastery ?? 0)) / 100}
                                            strokeLinecap="round"
                                            className="transition-all duration-1000 ease-out"
                                        />
                                    </svg>
                                    <div className="absolute text-center">
                                        <span className="text-4xl font-extrabold text-[var(--color-text)]">{stats?.averageMastery ?? offlineStats?.avgMastery ?? 0}%</span>
                                        <span className="block text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-wider mt-0.5">Mastery</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-center text-xs text-[var(--color-muted)] bg-[var(--color-background)] py-2.5 rounded-xl border border-[var(--color-border)]">
                            {loading ? (
                                <span className="text-[var(--color-muted)] font-bold">Loading mastery...</span>
                            ) : ((stats?.averageMastery ?? offlineStats?.avgMastery ?? 0) >= 80) ? (
                                '🌟 Excellent Progress!'
                            ) : (
                                '📈 Keep practicing to unlock mastery!'
                            )}
                        </div>
                    </div>

                    {/* Recent Attempts logs */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl lg:col-span-2 shadow-sm">
                        <h2 className="text-lg font-bold text-[var(--color-text)]">Recent Quiz Activity</h2>
                        <p className="text-[var(--color-muted)] text-xs mt-1">
                            {isOnline ? 'Your recent diagnostic quiz assessments.' : '📱 Cached data — will sync when online'}
                        </p>

                        <div className="mt-6 space-y-4">
                            {loading ? (
                                [1, 2, 3].map((n) => (
                                    <div key={n} className="flex items-center justify-between p-4 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl animate-pulse">
                                        <div className="flex items-center space-x-3 w-2/3">
                                            <div className="h-9 w-9 bg-[var(--color-surface)] rounded-lg shrink-0" />
                                            <div className="space-y-2 w-full">
                                                <div className="h-4 bg-[var(--color-surface)] rounded w-3/4" />
                                                <div className="h-3 bg-[var(--color-surface)] rounded w-1/4" />
                                            </div>
                                        </div>
                                        <div className="h-5 bg-[var(--color-surface)] rounded w-12" />
                                    </div>
                                ))
                            ) : recentAttempts.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-[var(--color-border)] rounded-xl bg-[var(--color-background)]">
                                    <p className="text-sm text-[var(--color-muted)]">No attempts found yet.</p>
                                    <Link href="/subjects" className="text-[var(--color-primary)] hover:opacity-80 text-xs font-semibold mt-2 inline-block">
                                        Take your first quiz now →
                                    </Link>
                                </div>
                            ) : (
                                recentAttempts.map((attempt) => (
                                    <div key={attempt.id} className="flex items-center justify-between p-4 bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] rounded-xl transition-all">
                                        <div className="flex items-center space-x-3">
                                            <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                </svg>
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-semibold text-[var(--color-text)]">{attempt.quiz_title}</h3>
                                                <p className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider">
                                                    {attempt.status === 'completed' ? 'Completed' : 'In Progress'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-[var(--color-text)]">
                                                {attempt.score !== null && attempt.total_marks !== null ? `${attempt.score}/${attempt.total_marks}` : 'N/A'}
                                            </span>
                                            {attempt.score !== null && attempt.total_marks !== null && attempt.total_marks > 0 && (
                                                <span className="block text-[10px] text-[var(--color-muted)] font-semibold uppercase tracking-wider mt-0.5">
                                                    {Math.round((attempt.score / attempt.total_marks) * 100)}% accuracy
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function StatCard({ label, value, subtitle, icon, loading }: {
    label: string;
    value: any;
    subtitle?: string;
    icon: React.ReactNode;
    loading: boolean;
}) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-2xl flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start">
                <span className="text-[var(--color-muted)] font-medium text-sm">{label}</span>
                <span className="p-2 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg">
                    {icon}
                </span>
            </div>
            <div className="mt-4">
                {loading ? (
                    <div className="h-9 w-12 bg-[var(--color-background)] rounded-lg animate-pulse" />
                ) : (
                    <>
                        <span className="text-3xl font-bold text-[var(--color-text)]">{value}</span>
                        {subtitle && <p className="text-xs text-[var(--color-muted)] mt-1">{subtitle}</p>}
                    </>
                )}
            </div>
        </div>
    );
}
