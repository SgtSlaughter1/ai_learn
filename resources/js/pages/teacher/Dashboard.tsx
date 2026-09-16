import React, { useEffect, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';

interface School {
    id: number;
    name: string;
    slug: string;
}

interface ClassItem {
    id: number;
    name: string;
    slug: string;
    grade_level: string | null;
    learner_count: number;
}

interface Learner {
    id: string;
    name: string;
    email: string;
    level: number;
    tier: string;
    total_xp: number;
    streak: number;
    topics_covered: number;
    avg_mastery: number;
    total_attempted: number;
    total_correct: number;
}

interface Overview {
    total_learners: number;
    total_attempted: number;
    total_correct: number;
    avg_mastery: number;
    total_attempts: number;
    avg_score: number;
    best_score: number;
}

interface Stats {
    overview: Overview;
    top_performers: Learner[];
    struggling_learners: { id: string; name: string; avg_mastery: number }[];
    classes: { id: number; name: string; learner_count: number }[];
}

interface Props {
    school: School | null;
    classes: ClassItem[];
    selectedClass: number | null;
}

export default function Dashboard({ school, classes, selectedClass }: Props) {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [showCreateClass, setShowCreateClass] = useState(false);
    const [showEnrollModal, setShowEnrollModal] = useState(false);
    const [enrollEmail, setEnrollEmail] = useState('');
    const [createClassForm, setCreateClassForm] = useState({ name: '', grade_level: '', section: '' });
    const [activeTab, setActiveTab] = useState<'overview' | 'learners' | 'top' | 'struggling'>('overview');


    useEffect(() => {
        fetchStats();
    }, [selectedClass]);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = selectedClass ? `?class_id=${selectedClass}` : '';
            const res = await fetch(`/api/v1/teacher/stats${params}`);
            const data = await res.json();
            setStats(data);
        } catch (e) {
            console.error('Failed to load teacher stats', e);
        } finally {
            setLoading(false);
        }
    };

    const selectClass = (classId: number | null) => {
        router.get('/teacher/dashboard', { class_id: classId }, { preserveState: true, replace: true });
    };

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch('/api/v1/teacher/classes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify(createClassForm),
            });
            if (res.ok) {
                setShowCreateClass(false);
                setCreateClassForm({ name: '', grade_level: '', section: '' });
                window.location.reload();
            }
        } catch (e) {
            console.error('Failed to create class', e);
        }
    };

    const handleEnrollLearner = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClass) return;
        try {
            const res = await fetch(`/api/v1/teacher/classes/${selectedClass}/enroll`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                body: JSON.stringify({ email: enrollEmail }),
            });
            if (res.ok) {
                setShowEnrollModal(false);
                setEnrollEmail('');
                fetchStats();
            }
        } catch (e) {
            console.error('Failed to enroll learner', e);
        }
    };

    const getTierColor = (level: number): string => {
        if (level <= 2) return 'text-[var(--color-muted)]';
        if (level <= 4) return 'text-[var(--color-primary-light)]';
        if (level <= 6) return 'text-[var(--color-success)]';
        if (level <= 8) return 'text-[var(--color-primary)]';
        if (level <= 10) return 'text-[var(--color-accent)]';
        if (level <= 12) return 'text-[var(--color-accent)]';
        if (level <= 14) return 'text-[var(--color-error)]';
        return 'text-[var(--color-accent)]';
    };

    const getMasteryColor = (score: number): string => {
        if (score >= 80) return 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20';
        if (score >= 60) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        if (score >= 40) return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    if (!school) {
        return (
            <AuthenticatedLayout
                header={<h1 className="text-2xl font-bold text-[var(--color-text)]">Teacher Dashboard</h1>}
            >
                <Head title="Teacher Dashboard" />
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">No School Assigned</h2>
                    <p className="text-[var(--color-muted)] max-w-md">
                        Your account isn't linked to a school yet. Please contact your school administrator to get set up.
                    </p>
                </div>
            </AuthenticatedLayout>
        );
    }

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text)]">Teacher Dashboard</h1>
                        <p className="text-sm text-[var(--color-muted)] mt-1">{school.name}</p>
                    </div>
                    <div className="flex gap-2">
                        {selectedClass && (
                            <button
                                onClick={() => setShowEnrollModal(true)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Enroll Learner</span>
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreateClass(true)}
                            className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>New Class</span>
                        </button>
                    </div>
                </div>
            }
        >
            <Head>
                <title>Teacher Dashboard — AILEARN</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            {/* Class Selector Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => selectClass(null)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        !selectedClass
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
                    }`}
                >
                    All Classes
                </button>
                {classes.map((cls) => (
                    <button
                        key={cls.id}
                        onClick={() => selectClass(cls.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
                            selectedClass === cls.id
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] border border-[var(--color-border)]'
                        }`}
                    >
                        {cls.name} ({cls.learner_count})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-r-transparent"></div>
                    <p className="text-[var(--color-muted)] mt-3">Loading dashboard...</p>
                </div>
            ) : stats ? (
                <>
                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            label="Total Learners"
                            value={stats.overview.total_learners}
                            icon={
                                <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Avg Mastery"
                            value={`${stats.overview.avg_mastery}%`}
                            icon={
                                <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Avg Quiz Score"
                            value={`${stats.overview.avg_score}%`}
                            icon={
                                <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                            }
                        />
                        <StatCard
                            label="Questions Answered"
                            value={stats.overview.total_attempted.toLocaleString()}
                            icon={
                                <svg className="w-5 h-5 text-[var(--color-primary-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex flex-wrap gap-1.5 mb-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-1.5 w-fit">
                        {[
                            {
                                key: 'overview' as const,
                                label: 'Overview',
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                ),
                            },
                            {
                                key: 'learners' as const,
                                label: 'Learners',
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                ),
                            },
                            {
                                key: 'top' as const,
                                label: 'Top Performers',
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                ),
                            },
                            {
                                key: 'struggling' as const,
                                label: 'Needs Help',
                                icon: (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                ),
                            },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                                    activeTab === tab.key
                                        ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Top Performers Mini */}
                            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                <h3 className="text-base font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                    </svg>
                                    <span>Top Performers</span>
                                </h3>
                                {stats.top_performers.length === 0 ? (
                                    <p className="text-[var(--color-muted)] text-sm">No data yet</p>
                                ) : (
                                    <div className="space-y-3">
                                        {stats.top_performers.slice(0, 5).map((p, i) => (
                                            <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-background)] transition-colors">
                                                <span className="w-6 h-6 rounded-full bg-[var(--color-primary-5)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] flex items-center justify-center">
                                                    {i + 1}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{p.name}</p>
                                                    <p className="text-xs text-[var(--color-muted)]">Lv.{p.level} {p.tier}</p>
                                                </div>
                                                <span className="text-xs font-bold text-[var(--color-accent)] bg-[var(--color-accent-10)] px-2.5 py-1 rounded-full border border-[var(--color-accent-20)]">
                                                    {p.total_xp} XP
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Struggling Learners Mini */}
                            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                <h3 className="text-base font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>Needs Attention</span>
                                </h3>
                                {stats.struggling_learners.length === 0 ? (
                                    <div className="p-6 text-center text-sm text-[var(--color-success)] bg-[var(--color-success-10)] rounded-xl border border-[var(--color-success-20)]">
                                        All learners are on track and performing well.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {stats.struggling_learners.slice(0, 5).map((l) => (
                                            <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-background)] transition-colors">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{l.name}</p>
                                                </div>
                                                <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
                                                    {l.avg_mastery}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'learners' && (
                        <ClassLearnersPanel selectedClass={selectedClass} getTierColor={getTierColor} getMasteryColor={getMasteryColor} />
                    )}

                    {activeTab === 'top' && (
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                <span>Class Leaderboard</span>
                            </h3>
                            {stats.top_performers.length === 0 ? (
                                <p className="text-[var(--color-muted)] text-sm text-center py-8">No learners have earned XP yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.top_performers.map((p, i) => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl border ${
                                                i === 0 ? 'bg-[var(--color-accent-10)] border-[var(--color-accent-20)]' :
                                                i === 1 ? 'bg-[var(--color-primary-5)] border-[var(--color-border)]' :
                                                i === 2 ? 'bg-[var(--color-accent-10)] border-[var(--color-accent-20)]' :
                                                'bg-[var(--color-surface)] border-[var(--color-border)]'
                                            }`}
                                        >
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                                                i === 0 ? 'bg-[var(--color-accent)] text-white' :
                                                i === 1 ? 'bg-[var(--color-muted)] text-white' :
                                                i === 2 ? 'bg-[var(--color-accent)] text-white' :
                                                'bg-[var(--color-background)] text-[var(--color-muted)] border border-[var(--color-border)]'
                                            }`}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[var(--color-text)] truncate">{p.name}</p>
                                                <p className="text-xs text-[var(--color-muted)]">{p.total_attempted} questions answered</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${getTierColor(p.level)}`}>{p.tier}</p>
                                                <p className="text-xs text-[var(--color-muted)]">Lv.{p.level}</p>
                                            </div>
                                            <span className="text-sm font-extrabold text-[var(--color-accent)] bg-[var(--color-accent-10)] px-3 py-1 rounded-full border border-[var(--color-accent-20)]">
                                                {p.total_xp} XP
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'struggling' && (
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2 flex items-center gap-2">
                                <svg className="w-5 h-5 text-[var(--color-error)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Learners Needing Attention</span>
                            </h3>
                            <p className="text-xs text-[var(--color-muted)] mb-6">These learners have below 40% average mastery and may need extra support.</p>
                            {stats.struggling_learners.length === 0 ? (
                                <div className="text-center py-12 bg-[var(--color-background)] rounded-2xl border border-[var(--color-border)]">
                                    <div className="w-12 h-12 rounded-2xl bg-[var(--color-success-10)] text-[var(--color-success)] flex items-center justify-center mx-auto mb-3 border border-[var(--color-success-20)]">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-[var(--color-success)] font-bold text-sm">All learners are performing well!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {stats.struggling_learners.map((l) => (
                                        <div key={l.id} className="flex items-center gap-4 p-4 bg-[var(--color-error-10)]/40 border border-[var(--color-error-20)] rounded-xl">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[var(--color-text)]">{l.name}</p>
                                                <p className="text-xs text-[var(--color-muted)]">Average mastery across all topics</p>
                                            </div>
                                            <span className={`px-3 py-1.5 text-xs font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
                                                {l.avg_mastery}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <p className="text-[var(--color-muted)] text-center py-16">No stats available</p>
            )}

            {/* Create Class Modal */}
            {showCreateClass && (
                <Modal onClose={() => setShowCreateClass(false)} title="Create New Class">
                    <form onSubmit={handleCreateClass} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">Class Name</label>
                            <input
                                type="text"
                                required
                                value={createClassForm.name}
                                onChange={(e) => setCreateClassForm({ ...createClassForm, name: e.target.value })}
                                placeholder="e.g. JSS3 Blue"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">Grade Level</label>
                                <input
                                    type="text"
                                    value={createClassForm.grade_level}
                                    onChange={(e) => setCreateClassForm({ ...createClassForm, grade_level: e.target.value })}
                                    placeholder="e.g. JSS3"
                                    className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">Section</label>
                                <input
                                    type="text"
                                    value={createClassForm.section}
                                    onChange={(e) => setCreateClassForm({ ...createClassForm, section: e.target.value })}
                                    placeholder="e.g. Blue"
                                    className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateClass(false)}
                                className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] text-sm font-semibold rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                            >
                                Create Class
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Enroll Learner Modal */}
            {showEnrollModal && (
                <Modal onClose={() => setShowEnrollModal(false)} title="Enroll Learner">
                    <form onSubmit={handleEnrollLearner} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-text)] mb-1">Learner Email</label>
                            <input
                                type="email"
                                required
                                value={enrollEmail}
                                onChange={(e) => setEnrollEmail(e.target.value)}
                                placeholder="learner@email.com"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)]"
                            />
                            <p className="text-xs text-[var(--color-muted)] mt-1">The learner must already have an account</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowEnrollModal(false)}
                                className="flex-1 px-4 py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] text-sm font-semibold rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer"
                            >
                                Enroll
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </AuthenticatedLayout>
    );
}

// ── Sub-components ──

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-border)]">
                    {icon}
                </div>
            </div>
            <p className="text-2xl font-black text-[var(--color-text)]">{value}</p>
            <p className="text-xs text-[var(--color-muted)] mt-1">{label}</p>
        </div>
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-3">
                    <h3 className="text-base font-bold text-[var(--color-text)]">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ClassLearnersPanel({
    selectedClass,
    getTierColor,
    getMasteryColor,
}: {
    selectedClass: number | null;
    getTierColor: (level: number) => string;
    getMasteryColor: (score: number) => string;
}) {
    const [learners, setLearners] = useState<Learner[]>([]);
    const [className, setClassName] = useState('');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (!selectedClass) {
            setLearners([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        fetch(`/api/v1/teacher/classes/${selectedClass}/learners`)
            .then((r) => r.json())
            .then((data) => {
                setLearners(data.learners || []);
                setClassName(data.class?.name || '');
            })
            .catch(() => setLearners([]))
            .finally(() => setLoading(false));
    }, [selectedClass]);

    if (!selectedClass) {
        return (
            <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
                <p className="text-[var(--color-muted)]">Select a class to view learners</p>
            </div>
        );
    }

    const filtered = learners.filter(
        (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>{className} — {learners.length} Enrolled Learners</span>
                </h3>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search learners..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] w-56 focus:outline-none focus:border-[var(--color-primary)]"
                    />
                    <span className="absolute left-3 top-2.5 text-[var(--color-muted)]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-r-transparent"></div>
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-[var(--color-muted)] text-xs text-center py-8">
                    {learners.length === 0 ? 'No learners enrolled yet. Click "+ Enroll Learner" to add one.' : 'No learners match your search.'}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)] font-bold uppercase tracking-wider">
                            <tr>
                                <th className="pb-3">Name</th>
                                <th className="pb-3">Level</th>
                                <th className="pb-3">XP</th>
                                <th className="pb-3">Streak</th>
                                <th className="pb-3">Mastery</th>
                                <th className="pb-3">Accuracy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {filtered.map((l) => (
                                <tr key={l.id} className="hover:bg-[var(--color-background)] transition-colors">
                                    <td className="py-3">
                                        <p className="font-bold text-[var(--color-text)]">{l.name}</p>
                                        <p className="text-[11px] text-[var(--color-muted)]">{l.email}</p>
                                    </td>
                                    <td className="py-3">
                                        <span className={`font-bold ${getTierColor(l.level)}`}>Lv.{l.level}</span>
                                        <span className="text-[11px] text-[var(--color-muted)] ml-1">{l.tier}</span>
                                    </td>
                                    <td className="py-3 font-bold text-[var(--color-accent)]">{l.total_xp}</td>
                                    <td className="py-3">
                                        {l.streak > 0 ? (
                                            <span className="text-[var(--color-accent)] font-bold flex items-center gap-1">
                                                <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.527.82-1.17 1.95-1.17 3.952 0 .57.065 1.05.158 1.474-.298-.242-.647-.532-.977-.866a1 1 0 00-1.44.095c-.822 1.002-1.394 2.37-1.394 3.791 0 3.314 2.686 6 6 6s6-2.686 6-6c0-2.434-1.206-4.524-2.355-5.941z" clipRule="evenodd" />
                                                </svg>
                                                <span>{l.streak}d</span>
                                            </span>
                                        ) : (
                                            <span className="text-[var(--color-muted)]">—</span>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
                                            {l.avg_mastery}%
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <span className="text-[var(--color-muted)] font-medium">
                                            {l.total_attempted > 0
                                                ? `${Math.round((l.total_correct / l.total_attempted) * 100)}%`
                                                : '—'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
