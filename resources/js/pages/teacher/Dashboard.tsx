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
    rank: string;
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

    const getRankColor = (level: number): string => {
        if (level <= 2) return 'text-[var(--color-muted)]';
        if (level <= 4) return 'text-blue-400';
        if (level <= 6) return 'text-[var(--color-success)]';
        if (level <= 8) return 'text-purple-400';
        if (level <= 10) return 'text-[var(--color-accent)]';
        if (level <= 12) return 'text-[var(--color-accent)]';
        if (level <= 14) return 'text-red-400';
        return 'text-pink-400';
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
                    <div className="text-6xl mb-4">🏫</div>
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
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                + Enroll Learner
                            </button>
                        )}
                        <button
                            onClick={() => setShowCreateClass(true)}
                            className="px-4 py-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                            + New Class
                        </button>
                    </div>
                </div>
            }
        >
            <Head title="Teacher Dashboard" />

            {/* Class Selector Tabs */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <button
                    onClick={() => selectClass(null)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                        !selectedClass
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-[var(--color-primary-5)] text-[var(--color-muted)] hover:bg-[var(--color-primary-5)] hover:text-[var(--color-text)]'
                    }`}
                >
                    All Classes
                </button>
                {classes.map((cls) => (
                    <button
                        key={cls.id}
                        onClick={() => selectClass(cls.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                            selectedClass === cls.id
                                ? 'bg-[var(--color-primary)] text-white'
                                : 'bg-[var(--color-primary-5)] text-[var(--color-muted)] hover:bg-[var(--color-primary-5)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        {cls.name} ({cls.learner_count})
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-16">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-teal-400 border-r-transparent"></div>
                    <p className="text-[var(--color-muted)] mt-3">Loading dashboard...</p>
                </div>
            ) : stats ? (
                <>
                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                        <StatCard label="Total Learners" value={stats.overview.total_learners} icon="👥" />
                        <StatCard label="Avg Mastery" value={`${stats.overview.avg_mastery}%`} icon="📊" />
                        <StatCard label="Avg Quiz Score" value={`${stats.overview.avg_score}%`} icon="📝" />
                        <StatCard label="Questions Answered" value={stats.overview.total_attempted.toLocaleString()} icon="❓" />
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 mb-6 bg-[var(--color-surface)] rounded-lg p-1 w-fit">
                        {[
                            { key: 'overview' as const, label: '📊 Overview' },
                            { key: 'learners' as const, label: '👥 Learners' },
                            { key: 'top' as const, label: '🏆 Top Performers' },
                            { key: 'struggling' as const, label: '⚠️ Needs Help' },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                                    activeTab === tab.key
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'overview' && (
                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Top Performers Mini */}
                            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">🏆 Top Performers</h3>
                                {stats.top_performers.length === 0 ? (
                                    <p className="text-[var(--color-muted)] text-sm">No data yet</p>
                                ) : (
                                    <div className="space-y-3">
                                        {stats.top_performers.slice(0, 5).map((p, i) => (
                                            <div key={p.id} className="flex items-center gap-3">
                                                <span className="text-lg font-bold text-[var(--color-muted)] w-6">#{i + 1}</span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{p.name}</p>
                                                    <p className="text-xs text-[var(--color-muted)]">Lv.{p.level} {p.rank}</p>
                                                </div>
                                                <span className="text-sm font-bold text-[var(--color-accent)]">{p.total_xp} XP</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Struggling Learners Mini */}
                            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                                <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">⚠️ Needs Attention</h3>
                                {stats.struggling_learners.length === 0 ? (
                                    <p className="text-[var(--color-success)] text-sm">All learners are doing well! 🎉</p>
                                ) : (
                                    <div className="space-y-3">
                                        {stats.struggling_learners.slice(0, 5).map((l) => (
                                            <div key={l.id} className="flex items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-[var(--color-text)] truncate">{l.name}</p>
                                                </div>
                                                <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
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
                        <ClassLearnersPanel selectedClass={selectedClass} getRankColor={getRankColor} getMasteryColor={getMasteryColor} />
                    )}

                    {activeTab === 'top' && (
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-6">🏆 Class Leaderboard</h3>
                            {stats.top_performers.length === 0 ? (
                                <p className="text-[var(--color-muted)] text-sm text-center py-8">No learners have earned XP yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {stats.top_performers.map((p, i) => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-4 rounded-lg ${
                                                i === 0 ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20' :
                                                i === 1 ? 'bg-slate-400/10 border border-slate-400/20' :
                                                i === 2 ? 'bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20' :
                                                'bg-[var(--color-primary-5)]/30'
                                            }`}
                                        >
                                            <span className={`text-2xl font-black w-10 text-center ${i === 0 ? 'text-[var(--color-accent)]' : i === 1 ? 'text-[var(--color-text)]' : i === 2 ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[var(--color-text)] truncate">{p.name}</p>
                                                <p className="text-xs text-[var(--color-muted)]">{p.total_attempted} questions answered</p>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-sm font-bold ${getRankColor(p.level)}`}>{p.rank}</p>
                                                <p className="text-xs text-[var(--color-muted)]">Lv.{p.level}</p>
                                            </div>
                                            <span className="text-lg font-black text-[var(--color-accent)]">{p.total_xp} XP</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'struggling' && (
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">⚠️ Learners Needing Attention</h3>
                            <p className="text-sm text-[var(--color-muted)] mb-6">These learners have below 40% average mastery and may need extra support.</p>
                            {stats.struggling_learners.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="text-4xl mb-3">🎉</div>
                                    <p className="text-[var(--color-success)] font-semibold">All learners are performing well!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {stats.struggling_learners.map((l) => (
                                        <div key={l.id} className="flex items-center gap-4 p-4 bg-[var(--color-error)]/5 border border-[var(--color-error)]/10 rounded-lg">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[var(--color-text)]">{l.name}</p>
                                                <p className="text-xs text-[var(--color-muted)]">Average mastery across all topics</p>
                                            </div>
                                            <span className={`px-3 py-1.5 text-sm font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
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
                            <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Class Name</label>
                            <input
                                type="text"
                                required
                                value={createClassForm.name}
                                onChange={(e) => setCreateClassForm({ ...createClassForm, name: e.target.value })}
                                placeholder="e.g. JSS3 Blue"
                                className="w-full px-4 py-2.5 bg-[var(--color-primary-5)] border border-slate-700 rounded-lg text-[var(--color-text)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Grade Level</label>
                                <input
                                    type="text"
                                    value={createClassForm.grade_level}
                                    onChange={(e) => setCreateClassForm({ ...createClassForm, grade_level: e.target.value })}
                                    placeholder="e.g. JSS3"
                                    className="w-full px-4 py-2.5 bg-[var(--color-primary-5)] border border-slate-700 rounded-lg text-[var(--color-text)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Section</label>
                                <input
                                    type="text"
                                    value={createClassForm.section}
                                    onChange={(e) => setCreateClassForm({ ...createClassForm, section: e.target.value })}
                                    placeholder="e.g. Blue"
                                    className="w-full px-4 py-2.5 bg-[var(--color-primary-5)] border border-slate-700 rounded-lg text-[var(--color-text)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateClass(false)}
                                className="flex-1 px-4 py-2.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] text-sm font-semibold rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white text-sm font-semibold rounded-lg transition-colors"
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
                            <label className="block text-sm font-semibold text-[var(--color-text)] mb-1">Learner Email</label>
                            <input
                                type="email"
                                required
                                value={enrollEmail}
                                onChange={(e) => setEnrollEmail(e.target.value)}
                                placeholder="learner@email.com"
                                className="w-full px-4 py-2.5 bg-[var(--color-primary-5)] border border-slate-700 rounded-lg text-[var(--color-text)] text-sm focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                            />
                            <p className="text-xs text-[var(--color-muted)] mt-1">The learner must already have an account</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowEnrollModal(false)}
                                className="flex-1 px-4 py-2.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] text-sm font-semibold rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
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

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: string }) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
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
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-[var(--color-text)]">{title}</h3>
                    <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-xl">✕</button>
                </div>
                {children}
            </div>
        </div>
    );
}

function ClassLearnersPanel({
    selectedClass,
    getRankColor,
    getMasteryColor,
}: {
    selectedClass: number | null;
    getRankColor: (level: number) => string;
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
            <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
                <p className="text-[var(--color-muted)]">Select a class to view learners</p>
            </div>
        );
    }

    const filtered = learners.filter(
        (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-[var(--color-text)]">👥 {className} — {learners.length} Learners</h3>
                <input
                    type="text"
                    placeholder="Search learners..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="px-4 py-2 bg-[var(--color-primary-5)] border border-slate-700 rounded-lg text-sm text-[var(--color-text)] w-48 focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                />
            </div>

            {loading ? (
                <div className="text-center py-8">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-teal-400 border-r-transparent"></div>
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-[var(--color-muted)] text-sm text-center py-8">
                    {learners.length === 0 ? 'No learners enrolled yet. Click "+ Enroll Learner" to add one.' : 'No learners match your search.'}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                                <th className="pb-3 font-semibold">Name</th>
                                <th className="pb-3 font-semibold">Level</th>
                                <th className="pb-3 font-semibold">XP</th>
                                <th className="pb-3 font-semibold">Streak</th>
                                <th className="pb-3 font-semibold">Mastery</th>
                                <th className="pb-3 font-semibold">Accuracy</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                            {filtered.map((l) => (
                                <tr key={l.id} className="hover:bg-[var(--color-primary-5)]/30 transition-colors">
                                    <td className="py-3">
                                        <p className="font-semibold text-[var(--color-text)]">{l.name}</p>
                                        <p className="text-xs text-[var(--color-muted)]">{l.email}</p>
                                    </td>
                                    <td className="py-3">
                                        <span className={`font-bold ${getRankColor(l.level)}`}>Lv.{l.level}</span>
                                        <span className="text-xs text-[var(--color-muted)] ml-1">{l.rank}</span>
                                    </td>
                                    <td className="py-3 font-bold text-[var(--color-accent)]">{l.total_xp}</td>
                                    <td className="py-3">
                                        {l.streak > 0 ? (
                                            <span className="text-[var(--color-accent)]">🔥 {l.streak}</span>
                                        ) : (
                                            <span className="text-[var(--color-muted)]">—</span>
                                        )}
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 text-xs font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
                                            {l.avg_mastery}%
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <span className="text-[var(--color-muted)]">
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
