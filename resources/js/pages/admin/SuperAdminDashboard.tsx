import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { Stats, SchoolItem, SchoolAdminItem, SubjectItem, QuestionItem, TopicItem } from '@/types/admin';
import {
    cacheAdminSchools,
    getCachedAdminSchools,
    cacheAdminSchoolAdmins,
    getCachedAdminSchoolAdmins,
    cacheAdminSubjects,
    getCachedAdminSubjects,
    cacheAdminQuestions,
    getCachedAdminQuestions,
    cacheAdminTopics,
    getCachedAdminTopics,
    ADMIN_DATA_CHANGED_EVENT,
} from '@/services/AdminOfflineService';
import SchoolsTab from '@/components/admin/SchoolsTab';
import SchoolAdminsTab from '@/components/admin/SchoolAdminsTab';
import SubjectsTab from '@/components/admin/SubjectsTab';
import QuestionBankTab from '@/components/admin/QuestionBankTab';

export default function SuperAdminDashboard() {
    const { auth } = usePage<{ auth: { user: { id: number; name: string; email: string; role: string } } }>().props;
    const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'school_admins' | 'subjects' | 'questions'>('overview');

    // Data States
    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    const [schools, setSchools] = useState<SchoolItem[]>([]);
    const [loadingSchools, setLoadingSchools] = useState(false);

    const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdminItem[]>([]);
    const [loadingSchoolAdmins, setLoadingSchoolAdmins] = useState(false);

    const [subjects, setSubjects] = useState<SubjectItem[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(false);

    const [allTopics, setAllTopics] = useState<TopicItem[]>([]);

    const [questions, setQuestions] = useState<QuestionItem[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);

    // Toast Notification
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    // Fetch Stats
    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await fetch('/api/v1/admin/stats');
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success') {
                    setStats(data.data);
                    localStorage.setItem('cached_admin_stats', JSON.stringify(data.data));
                } else if (data.overview) {
                    setStats(data);
                    localStorage.setItem('cached_admin_stats', JSON.stringify(data));
                }
            }
        } catch (e) {
            console.warn('Failed to load stats online, checking local cache:', e);
            const cached = localStorage.getItem('cached_admin_stats');
            if (cached) {
                try { setStats(JSON.parse(cached)); } catch {}
            }
        } finally {
            setLoadingStats(false);
        }
    };

    // Fetch Schools
    const fetchSchools = async () => {
        setLoadingSchools(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminSchools();
                setSchools(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/schools');
            if (res.ok) {
                const data = await res.json();
                const serverSchools = data.schools || data.data || [];
                setSchools(serverSchools);
                await cacheAdminSchools(serverSchools);
            } else {
                const cached = await getCachedAdminSchools();
                setSchools(cached);
            }
        } catch {
            const cached = await getCachedAdminSchools();
            setSchools(cached);
        } finally {
            setLoadingSchools(false);
        }
    };

    // Fetch School Admins
    const fetchSchoolAdmins = async () => {
        setLoadingSchoolAdmins(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminSchoolAdmins();
                setSchoolAdmins(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/school-admins');
            if (res.ok) {
                const data = await res.json();
                const serverAdmins = data.school_admins || data.data || [];
                setSchoolAdmins(serverAdmins);
                await cacheAdminSchoolAdmins(serverAdmins);
            } else {
                const cached = await getCachedAdminSchoolAdmins();
                setSchoolAdmins(cached);
            }
        } catch {
            const cached = await getCachedAdminSchoolAdmins();
            setSchoolAdmins(cached);
        } finally {
            setLoadingSchoolAdmins(false);
        }
    };

    // Fetch Subjects & Topics
    const fetchSubjects = async () => {
        setLoadingSubjects(true);
        try {
            if (!navigator.onLine) {
                const cachedSubs = await getCachedAdminSubjects();
                setSubjects(cachedSubs);
                const cachedTops = await getCachedAdminTopics();
                setAllTopics(cachedTops);
                return;
            }
            const res = await fetch('/api/v1/admin/subjects');
            if (res.ok) {
                const data = await res.json();
                const serverSubjects: SubjectItem[] = data.subjects || data.data || [];
                setSubjects(serverSubjects);
                await cacheAdminSubjects(serverSubjects);

                const extractedTopics = serverSubjects.flatMap((s) => s.topics || []);
                setAllTopics(extractedTopics);
                if (extractedTopics.length > 0) {
                    await cacheAdminTopics(extractedTopics);
                }
            } else {
                const cached = await getCachedAdminSubjects();
                setSubjects(cached);
            }
        } catch {
            const cached = await getCachedAdminSubjects();
            setSubjects(cached);
        } finally {
            setLoadingSubjects(false);
        }
    };

    // Fetch Questions
    const fetchQuestions = async () => {
        setLoadingQuestions(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminQuestions();
                setQuestions(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/questions');
            if (res.ok) {
                const data = await res.json();
                const serverQuestions = data.questions || data.data || [];
                setQuestions(serverQuestions);
                await cacheAdminQuestions(serverQuestions);
            } else {
                const cached = await getCachedAdminQuestions();
                setQuestions(cached);
            }
        } catch {
            const cached = await getCachedAdminQuestions();
            setQuestions(cached);
        } finally {
            setLoadingQuestions(false);
        }
    };

    useEffect(() => {
        fetchStats();
        fetchSchools();
        fetchSchoolAdmins();
        fetchSubjects();
        fetchQuestions();

        const handleDataChange = () => {
            fetchStats();
            fetchSchools();
            fetchSchoolAdmins();
            fetchSubjects();
            fetchQuestions();
        };

        window.addEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
        return () => window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
    }, []);

    return (
        <AuthenticatedLayout>
            <Head title="Super Admin Dashboard | AceDrill" />

            {/* Toast Notifications */}
            {toast && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border text-sm transition-all duration-300 ${
                        toast.type === 'success'
                            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/30 backdrop-blur-md'
                            : 'bg-rose-950/90 text-rose-200 border-rose-500/30 backdrop-blur-md'
                    }`}
                >
                    {toast.type === 'success' ? (
                        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg className="w-4 h-4 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-[var(--color-border)]">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-2xl font-black text-[var(--color-text)]">
                                Platform Super Admin
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                Multi-Tenant Master Console
                            </span>
                        </div>
                        <p className="text-xs text-[var(--color-muted)] mt-1">
                            Signed in as <span className="font-semibold text-[var(--color-text)]">{auth.user.name}</span> ({auth.user.email}) • Platform-wide governance
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                fetchStats();
                                fetchSchools();
                                fetchSchoolAdmins();
                                showToast('Synchronized platform data!');
                            }}
                            className="px-3.5 py-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Refresh Data</span>
                        </button>
                    </div>
                </div>

                {/* Platform Navigation Tabs */}
                <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 border-b border-[var(--color-border)]">
                    {[
                        {
                            key: 'overview' as const,
                            label: 'Platform Overview',
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            ),
                        },
                        {
                            key: 'schools' as const,
                            label: `Schools (${schools.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            ),
                        },
                        {
                            key: 'school_admins' as const,
                            label: `School Admins (${schoolAdmins.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            ),
                        },
                        {
                            key: 'subjects' as const,
                            label: `Global Curriculum (${subjects.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            ),
                        },
                        {
                            key: 'questions' as const,
                            label: `Question Bank (${questions.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ),
                        },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                                activeTab === tab.key
                                    ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] bg-[var(--color-surface)] border border-[var(--color-border)]'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Tab 1: Platform Overview */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* KPI Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                label="Registered Schools"
                                value={loadingStats ? '...' : (stats?.overview.total_schools ?? schools.length)}
                                subtitle="Active educational institutions"
                                icon={
                                    <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="School Administrators"
                                value={loadingStats ? '...' : (stats?.overview.total_school_admins ?? schoolAdmins.length)}
                                subtitle="Managing assigned schools"
                                icon={
                                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Total Platform Teachers"
                                value={loadingStats ? '...' : (stats?.overview.total_teachers ?? 0)}
                                subtitle="Class educators"
                                icon={
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Total Active Learners"
                                value={loadingStats ? '...' : (stats?.overview.total_learners ?? 0)}
                                subtitle="Enrolled across all schools"
                                icon={
                                    <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                    </svg>
                                }
                            />
                        </div>

                        {/* Secondary Stats Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <StatCard
                                label="Master Subjects"
                                value={loadingStats ? '...' : (stats?.overview.total_subjects ?? subjects.length)}
                                subtitle="Standard curriculum catalog"
                                icon={
                                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Curriculum Topics"
                                value={loadingStats ? '...' : (stats?.overview.total_topics ?? 0)}
                                subtitle="Diagnostic mastery nodes"
                                icon={
                                    <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Question Bank Items"
                                value={loadingStats ? '...' : (stats?.overview.total_questions ?? questions.length)}
                                subtitle="Practice, quiz & exam items"
                                icon={
                                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                }
                            />
                        </div>

                        {/* Schools Quick Summary */}
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--color-border)]">
                                <div>
                                    <h3 className="text-base font-bold text-[var(--color-text)]">Recent School Registrations</h3>
                                    <p className="text-xs text-[var(--color-muted)] mt-0.5">Institutions utilizing the AI Learning Platform</p>
                                </div>
                                <button
                                    onClick={() => setActiveTab('schools')}
                                    className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                                >
                                    Manage All Schools →
                                </button>
                            </div>

                            {schools.length === 0 ? (
                                <p className="text-xs text-[var(--color-muted)] py-4 text-center">No schools registered yet.</p>
                            ) : (
                                <div className="divide-y divide-[var(--color-border)]">
                                    {schools.slice(0, 5).map((sch) => (
                                        <div key={sch.id} className="py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="w-8 h-8 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-border)] flex items-center justify-center text-sm font-bold text-[var(--color-primary)]">
                                                    {sch.name.charAt(0)}
                                                </span>
                                                <div>
                                                    <p className="text-sm font-bold text-[var(--color-text)]">{sch.name}</p>
                                                    <p className="text-[11px] text-[var(--color-muted)]">{sch.city ? `${sch.city}, ${sch.state}` : (sch.slug || 'School')}</p>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${sch.is_active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                                                {sch.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Tab 2: Schools */}
                {activeTab === 'schools' && (
                    <SchoolsTab
                        schools={schools}
                        loading={loadingSchools}
                        onRefresh={fetchSchools}
                        showToast={showToast}
                    />
                )}

                {/* Tab 3: School Admins */}
                {activeTab === 'school_admins' && (
                    <SchoolAdminsTab
                        admins={schoolAdmins}
                        schools={schools}
                        loading={loadingSchoolAdmins}
                        onRefresh={fetchSchoolAdmins}
                        showToast={showToast}
                    />
                )}

                {/* Tab 4: Global Subjects */}
                {activeTab === 'subjects' && (
                    <SubjectsTab
                        subjects={subjects}
                        loading={loadingSubjects}
                        onRefresh={fetchSubjects}
                        showToast={showToast}
                    />
                )}

                {/* Tab 5: Question Bank */}
                {activeTab === 'questions' && (
                    <QuestionBankTab
                        questions={questions}
                        subjects={subjects}
                        allTopics={allTopics}
                        loading={loadingQuestions}
                        onRefresh={fetchQuestions}
                        showToast={showToast}
                    />
                )}
            </div>
        </AuthenticatedLayout>
    );
}

function StatCard({ label, value, subtitle, icon }: { label: string; value: string | number; subtitle: string; icon: React.ReactNode }) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-border)]">
                    {icon}
                </div>
            </div>
            <div>
                <p className="text-2xl font-black text-[var(--color-text)]">{value}</p>
                <p className="text-xs font-bold text-[var(--color-text)] mt-1">{label}</p>
                <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}
