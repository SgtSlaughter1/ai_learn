import { useEffect, useState } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';

interface Overview {
    total_schools: number;
    total_teachers: number;
    total_learners: number;
    total_classes: number;
    total_subjects: number;
    total_quizzes: number;
    total_attempts: number;
    total_questions_answered: number;
    avg_mastery: number;
    struggling_learners: number;
}

interface School {
    id: number;
    name: string;
    city: string | null;
    teacher_count: number;
    learner_count: number;
    class_count: number;
}

interface Teacher {
    id: string;
    name: string;
    school: string;
    learner_count: number;
}

interface Stats {
    overview: Overview;
    schools: School[];
    top_teachers: Teacher[];
    recent_users: Record<string, { role: string; count: number; date: string }[]>;
}

export default function Dashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/v1/admin/stats')
            .then((res) => res.json())
            .then((data) => {
                setStats(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load admin stats', err);
                setLoading(false);
            });
    }, []);

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-3xl font-extrabold text-[var(--color-text)] tracking-tight">Admin Dashboard</h1>
                    <p className="text-[var(--color-muted)] mt-1">Platform-wide overview and monitoring.</p>
                </div>
            }
        >
            <Head title="Admin Dashboard" />

            <div className="space-y-8">
                {/* Platform Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <AdminStatCard
                        label="Schools"
                        value={loading ? '...' : stats?.overview.total_schools}
                        icon="🏫"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Teachers"
                        value={loading ? '...' : stats?.overview.total_teachers}
                        icon="👨‍🏫"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Learners"
                        value={loading ? '...' : stats?.overview.total_learners}
                        icon="👥"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Classes"
                        value={loading ? '...' : stats?.overview.total_classes}
                        icon="📚"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Quizzes Taken"
                        value={loading ? '...' : stats?.overview.total_attempts?.toLocaleString()}
                        icon="📝"
                        loading={loading}
                    />
                </div>

                {/* Second Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <AdminStatCard
                        label="Questions Answered"
                        value={loading ? '...' : stats?.overview.total_questions_answered?.toLocaleString()}
                        icon="❓"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Avg Mastery"
                        value={loading ? '...' : `${stats?.overview.avg_mastery}%`}
                        icon="📊"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Subjects"
                        value={loading ? '...' : stats?.overview.total_subjects}
                        icon="📖"
                        loading={loading}
                    />
                    <AdminStatCard
                        label="Struggling Learners"
                        value={loading ? '...' : stats?.overview.struggling_learners}
                        icon="⚠️"
                        loading={loading}
                        alert={(stats?.overview.struggling_learners ?? 0) > 0}
                    />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Schools Table */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">🏫 Registered Schools</h3>
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((n) => (
                                    <div key={n} className="h-10 bg-[var(--color-primary-5)] rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : stats?.schools.length === 0 ? (
                            <p className="text-[var(--color-muted)] text-sm text-center py-8">No schools registered yet</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-[var(--color-muted)] border-b border-[var(--color-border)]">
                                            <th className="pb-2 font-semibold">School</th>
                                            <th className="pb-2 font-semibold">City</th>
                                            <th className="pb-2 font-semibold text-center">Teachers</th>
                                            <th className="pb-2 font-semibold text-center">Learners</th>
                                            <th className="pb-2 font-semibold text-center">Classes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--color-border)]/50">
                                        {stats?.schools.map((school) => (
                                            <tr key={school.id} className="hover:bg-[var(--color-primary-5)]/50 transition-colors">
                                                <td className="py-2.5 font-semibold text-[var(--color-text)]">{school.name}</td>
                                                <td className="py-2.5 text-[var(--color-muted)]">{school.city || '—'}</td>
                                                <td className="py-2.5 text-center font-bold text-[var(--color-primary)]">{school.teacher_count}</td>
                                                <td className="py-2.5 text-center font-bold text-[var(--color-primary)]">{school.learner_count}</td>
                                                <td className="py-2.5 text-center font-bold text-[var(--color-primary)]">{school.class_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Top Teachers */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">🏆 Top Teachers by Learners</h3>
                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((n) => (
                                    <div key={n} className="h-10 bg-[var(--color-primary-5)] rounded-lg animate-pulse" />
                                ))}
                            </div>
                        ) : stats?.top_teachers.length === 0 ? (
                            <p className="text-[var(--color-muted)] text-sm text-center py-8">No teachers with learners yet</p>
                        ) : (
                            <div className="space-y-3">
                                {stats?.top_teachers.map((teacher, i) => (
                                    <div key={teacher.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-primary-5)]/30">
                                        <span className={`text-lg font-black w-8 text-center ${i === 0 ? 'text-[var(--color-accent)]' : i === 1 ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-muted)]'}`}>
                                            #{i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[var(--color-text)]">{teacher.name}</p>
                                            <p className="text-xs text-[var(--color-muted)]">{teacher.school}</p>
                                        </div>
                                        <span className="text-sm font-bold text-[var(--color-primary)]">
                                            {teacher.learner_count} learners
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Activity Summary */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">📈 Platform Health</h3>
                    {loading ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((n) => (
                                <div key={n} className="h-16 bg-[var(--color-primary-5)] rounded-xl animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <HealthIndicator label="Avg Mastery" value={stats?.overview.avg_mastery ?? 0} type="mastery" />
                            <HealthIndicator label="Quiz Completion Rate" value={stats?.overview.total_attempts ?? 0} type="count" />
                            <HealthIndicator label="Learner-to-Teacher Ratio" value={
                                (stats?.overview.total_teachers ?? 0) > 0
                                    ? Math.round((stats?.overview.total_learners ?? 0) / stats!.overview.total_teachers)
                                    : 0
                            } type="ratio" />
                            <HealthIndicator label="Struggling Learners" value={stats?.overview.struggling_learners ?? 0} type="alert" />
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function AdminStatCard({ label, value, icon, loading, alert }: {
    label: string;
    value: any;
    icon: string;
    loading: boolean;
    alert?: boolean;
}) {
    return (
        <div className={`bg-[var(--color-surface)] border rounded-2xl p-5 shadow-sm transition-all ${alert ? 'border-[var(--color-error)]/30 bg-[var(--color-error)]/5' : 'border-[var(--color-border)]'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
            </div>
            {loading ? (
                <div className="h-8 w-16 bg-[var(--color-primary-5)] rounded-lg animate-pulse" />
            ) : (
                <p className="text-2xl font-black text-[var(--color-text)]">{value}</p>
            )}
            <p className="text-xs text-[var(--color-muted)] mt-1 font-medium">{label}</p>
        </div>
    );
}

function HealthIndicator({ label, value, type }: {
    label: string;
    value: number;
    type: 'mastery' | 'count' | 'ratio' | 'alert';
}) {
    const getColor = () => {
        switch (type) {
            case 'mastery':
                if (value >= 70) return 'text-[var(--color-success)]';
                if (value >= 40) return 'text-[var(--color-accent)]';
                return 'text-[var(--color-error)]';
            case 'alert':
                if (value === 0) return 'text-[var(--color-success)]';
                if (value <= 5) return 'text-[var(--color-accent)]';
                return 'text-[var(--color-error)]';
            case 'ratio':
                return 'text-[var(--color-primary)]';
            default:
                return 'text-[var(--color-primary)]';
        }
    };

    const getLabel = () => {
        switch (type) {
            case 'mastery': return value >= 70 ? 'Healthy' : value >= 40 ? 'Moderate' : 'Needs Attention';
            case 'alert': return value === 0 ? 'All Good' : value <= 5 ? 'Watch Closely' : 'Urgent';
            default: return '';
        }
    };

    return (
        <div className="text-center p-4 rounded-xl bg-[var(--color-primary-5)]/30">
            <p className={`text-2xl font-black ${getColor()}`}>{type === 'ratio' ? `${value}:1` : value.toLocaleString()}</p>
            <p className="text-xs text-[var(--color-muted)] font-semibold mt-1">{label}</p>
            {getLabel() && (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${getColor()}`}>
                    {getLabel()}
                </span>
            )}
        </div>
    );
}
