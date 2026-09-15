import React from 'react';
import { Stats } from '@/types/admin';

interface Props {
    stats: Stats | null;
    loading: boolean;
}

export default function OverviewTab({ stats, loading }: Props) {
    return (
        <div className="space-y-8">
            {/* School Admin Institution Banner */}
            {!stats?.is_super_admin && stats?.school && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="p-3 bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] rounded-xl">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-[var(--color-text)]">{stats.school.name}</h2>
                            <p className="text-xs text-[var(--color-muted)]">
                                {[stats.school.city, stats.school.state].filter(Boolean).join(', ') || 'Assigned Institution'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)]">
                            School Administrator
                        </span>
                    </div>
                </div>
            )}

            {/* Platform / School Stats Grid */}
            {stats?.is_super_admin ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <AdminStatCard
                        label="Total Schools"
                        value={loading ? '...' : stats?.overview.total_schools}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="School Admins"
                        value={loading ? '...' : stats?.overview.total_school_admins}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Total Learners"
                        value={loading ? '...' : stats?.overview.total_learners}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-3.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Classes & Cohorts"
                        value={loading ? '...' : stats?.overview.total_classes}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Subjects"
                        value={loading ? '...' : stats?.overview.total_subjects}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Topics"
                        value={loading ? '...' : stats?.overview.total_topics}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Quizzes & Tests"
                        value={loading ? '...' : stats?.overview.total_quizzes}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Question Bank"
                        value={loading ? '...' : stats?.overview.total_questions}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        }
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AdminStatCard
                        label="Total Learners"
                        value={loading ? '...' : stats?.overview.total_learners}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-3.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Classes & Cohorts"
                        value={loading ? '...' : stats?.overview.total_classes}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Subjects"
                        value={loading ? '...' : stats?.overview.total_subjects}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Topics"
                        value={loading ? '...' : stats?.overview.total_topics}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Question Bank"
                        value={loading ? '...' : stats?.overview.total_questions}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        }
                    />
                    <AdminStatCard
                        label="Quiz Attempts"
                        value={loading ? '...' : stats?.overview.total_attempts}
                        loading={loading}
                        icon={
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        }
                    />
                </div>
            )}

            {/* Academic Diagnostic Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <AdminStatCard
                    label="Questions Solved"
                    value={loading ? '...' : stats?.overview.total_questions_answered}
                    loading={loading}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    }
                />
                <AdminStatCard
                    label="Avg Mastery"
                    value={loading ? '...' : `${stats?.overview.avg_mastery}%`}
                    loading={loading}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    }
                />
                <AdminStatCard
                    label="Struggling Learners"
                    value={loading ? '...' : stats?.overview.struggling_learners}
                    loading={loading}
                    alert={(stats?.overview.struggling_learners ?? 0) > 0}
                    icon={
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    }
                />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Top Performing Learners */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Top Performing Learners</h3>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((n) => (
                                <div key={n} className="h-12 bg-[var(--color-primary-5)] rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : !stats?.top_learners || stats.top_learners.length === 0 ? (
                        <p className="text-[var(--color-muted)] text-sm text-center py-8">No learner activity recorded yet</p>
                    ) : (
                        <div className="space-y-3">
                            {stats.top_learners.map((learner, i) => (
                                <div key={learner.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-primary-5)]/30">
                                    <span className={`text-lg font-black w-8 text-center ${i === 0 ? 'text-[var(--color-accent)]' : i === 1 ? 'text-[var(--color-primary-light)]' : 'text-[var(--color-muted)]'}`}>
                                        #{i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[var(--color-text)]">{learner.name}</p>
                                        <p className="text-xs text-[var(--color-muted)]">{learner.grade_level} • {learner.tier || 'Newcomer'} (Lvl {learner.level})</p>
                                    </div>
                                    <span className="text-sm font-bold text-[var(--color-primary)]">
                                        {learner.total_xp.toLocaleString()} XP
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Grade Cohort Distribution */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-[var(--color-text)] mb-4">Grade Level Enrolments</h3>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4].map((n) => (
                                <div key={n} className="h-8 bg-[var(--color-primary-5)] rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : !stats?.grade_distribution || Object.keys(stats.grade_distribution).length === 0 ? (
                        <p className="text-[var(--color-muted)] text-sm text-center py-8">No grade level data available</p>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(stats.grade_distribution).map(([grade, count]) => {
                                const total = stats.overview.total_learners || 1;
                                const pct = Math.round((count / total) * 100);
                                return (
                                    <div key={grade}>
                                        <div className="flex justify-between text-xs font-semibold mb-1">
                                            <span className="text-[var(--color-text)]">{grade}</span>
                                            <span className="text-[var(--color-muted)]">{count} ({pct}%)</span>
                                        </div>
                                        <div className="h-2 bg-[var(--color-primary-5)] rounded-full overflow-hidden">
                                            <div className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Struggling Learners Table */}
            {stats?.struggling_learners && stats.struggling_learners.length > 0 && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-[var(--color-text)] flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                            Learners Requiring Academic Attention
                        </h3>
                        <span className="px-3 py-1 bg-red-500/10 text-red-500 text-xs font-bold rounded-full">
                            {stats.struggling_learners.length} Students
                        </span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)] uppercase tracking-wider">
                                    <th className="py-3 px-4">Student</th>
                                    <th className="py-3 px-4">Grade</th>
                                    <th className="py-3 px-4">School</th>
                                    <th className="py-3 px-4">Avg Mastery</th>
                                    <th className="py-3 px-4">Questions Attempted</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {stats.struggling_learners.map((learner) => (
                                    <tr key={learner.id} className="hover:bg-red-500/5 transition-colors">
                                        <td className="py-3 px-4">
                                            <p className="font-bold text-[var(--color-text)]">{learner.name}</p>
                                            <p className="text-[11px] text-[var(--color-muted)]">{learner.email}</p>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] font-bold">
                                                {learner.grade_level}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-[var(--color-muted)]">{learner.school}</td>
                                        <td className="py-3 px-4">
                                            <span className="font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">
                                                {learner.avg_mastery}%
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-[var(--color-text)] font-semibold">{learner.questions_attempted}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function AdminStatCard({ label, value, loading, alert, icon }: {
    label: string;
    value: any;
    loading: boolean;
    alert?: boolean;
    icon?: React.ReactNode;
}) {
    return (
        <div className={`bg-[var(--color-surface)] border rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between ${alert ? 'border-[var(--color-error)]/30 bg-[var(--color-error)]/5' : 'border-[var(--color-border)]'}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
                {loading ? (
                    <div className="h-8 w-16 bg-[var(--color-primary-5)] rounded-lg animate-pulse" />
                ) : (
                    <p className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--color-text)]">{value}</p>
                )}
                {icon && (
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                        {icon}
                    </div>
                )}
            </div>
            <p className="text-xs text-[var(--color-muted)] font-semibold leading-tight">{label}</p>
        </div>
    );
}
