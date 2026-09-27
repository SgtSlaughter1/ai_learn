import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { Stats, SchoolItem, TeacherItem, ClassItem, Learner, SubjectItem, QuestionItem, TopicItem } from '@/types/admin';
import {
    cacheAdminSchools,
    getCachedAdminSchools,
    cacheAdminTeachers,
    getCachedAdminTeachers,
    cacheAdminClasses,
    getCachedAdminClasses,
    cacheAdminLearners,
    getCachedAdminLearners,
    cacheAdminSubjects,
    getCachedAdminSubjects,
    cacheAdminQuestions,
    getCachedAdminQuestions,
    cacheAdminTopics,
    getCachedAdminTopics,
    getAdminAuthHeaders,
    ADMIN_DATA_CHANGED_EVENT,
} from '@/services/AdminOfflineService';
import TeachersTab from '@/components/admin/TeachersTab';
import ClassesTab from '@/components/admin/ClassesTab';
import LearnersTab from '@/components/admin/LearnersTab';
import SubjectsTab from '@/components/admin/SubjectsTab';
import QuestionBankTab from '@/components/admin/QuestionBankTab';
import { Skeleton } from '@/components/common/Skeleton';

export default function SchoolAdminDashboard() {
    const { auth } = usePage<{ auth: { user: { id: number; name: string; email: string; role: string } } }>().props;
    const [activeTab, setActiveTab] = useState<'overview' | 'teachers' | 'classes' | 'learners' | 'subjects' | 'questions'>('overview');

    // Data States
    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);

    const [schools, setSchools] = useState<SchoolItem[]>([]);
    const [, setLoadingSchools] = useState(false);

    const [teachers, setTeachers] = useState<TeacherItem[]>([]);
    const [loadingTeachers, setLoadingTeachers] = useState(false);

    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(false);

    const [learners, setLearners] = useState<Learner[]>([]);
    const [loadingLearners, setLoadingLearners] = useState(false);

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
            const res = await fetch('/api/v1/admin/stats', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
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

    // Fetch Schools (assigned to this admin)
    const fetchSchools = async () => {
        setLoadingSchools(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminSchools();
                setSchools(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/schools', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const serverSchools: SchoolItem[] = data.schools || data.data || [];
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

    // Fetch Teachers
    const fetchTeachers = async () => {
        setLoadingTeachers(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminTeachers();
                setTeachers(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/teachers', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const serverTeachers = data.teachers || data.data || [];
                setTeachers(serverTeachers);
                await cacheAdminTeachers(serverTeachers);
            } else {
                const cached = await getCachedAdminTeachers();
                setTeachers(cached);
            }
        } catch {
            const cached = await getCachedAdminTeachers();
            setTeachers(cached);
        } finally {
            setLoadingTeachers(false);
        }
    };

    // Fetch Classes
    const fetchClasses = async () => {
        setLoadingClasses(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminClasses();
                setClasses(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/classes', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const serverClasses = data.classes || data.data || [];
                setClasses(serverClasses);
                await cacheAdminClasses(serverClasses);
            } else {
                const cached = await getCachedAdminClasses();
                setClasses(cached);
            }
        } catch {
            const cached = await getCachedAdminClasses();
            setClasses(cached);
        } finally {
            setLoadingClasses(false);
        }
    };

    // Fetch Learners
    const fetchLearners = async () => {
        setLoadingLearners(true);
        try {
            if (!navigator.onLine) {
                const cached = await getCachedAdminLearners();
                setLearners(cached);
                return;
            }
            const res = await fetch('/api/v1/admin/learners', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                const serverLearners = data.learners || data.data || [];
                setLearners(serverLearners);
                await cacheAdminLearners(serverLearners);
            } else {
                const cached = await getCachedAdminLearners();
                setLearners(cached);
            }
        } catch {
            const cached = await getCachedAdminLearners();
            setLearners(cached);
        } finally {
            setLoadingLearners(false);
        }
    };

    // Fetch Subjects
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
            const res = await fetch('/api/v1/admin/subjects', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
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
            const res = await fetch('/api/v1/admin/questions', {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
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
        fetchTeachers();
        fetchClasses();
        fetchLearners();
        fetchSubjects();
        fetchQuestions();

        const handleDataChange = () => {
            fetchStats();
            fetchSchools();
            fetchTeachers();
            fetchClasses();
            fetchLearners();
            fetchSubjects();
            fetchQuestions();
        };

        window.addEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
        return () => window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
    }, []);

    const schoolName = stats?.school?.name || (schools[0]?.name) || 'School';

    return (
        <AuthenticatedLayout>
            <Head title={`${schoolName} | School Admin Dashboard`} />

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
                {/* School Header Banner */}
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-border)] flex items-center justify-center text-xl font-black text-[var(--color-primary)]">
                            {schoolName.charAt(0)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl font-black text-[var(--color-text)]">
                                    {schoolName}
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                    School Admin Portal
                                </span>
                            </div>
                            <p className="text-xs text-[var(--color-muted)] mt-1">
                                Signed in as <span className="font-semibold text-[var(--color-text)]">{auth.user.name}</span> • {stats?.school?.city ? `${stats.school.city}, ${stats.school.state}` : 'Academic Operations'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                fetchStats();
                                fetchSchools();
                                fetchTeachers();
                                fetchClasses();
                                fetchLearners();
                                showToast('Refreshed school records!');
                            }}
                            className="px-3.5 py-2 bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                        >
                            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Sync Records</span>
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 border-b border-[var(--color-border)]">
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
                            key: 'teachers' as const,
                            label: `Teachers (${teachers.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            ),
                        },
                        {
                            key: 'classes' as const,
                            label: `Classes & Arms (${classes.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            ),
                        },
                        {
                            key: 'learners' as const,
                            label: `Learners (${learners.length})`,
                            icon: (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                </svg>
                            ),
                        },
                        {
                            key: 'subjects' as const,
                            label: `Subjects (${subjects.length})`,
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

                {/* Tab 1: Overview */}
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        {/* School KPI Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatCard
                                label="Enrolled Learners"
                                value={loadingStats ? '...' : (stats?.overview.total_learners ?? learners.length)}
                                subtitle="Active school learners"
                                icon={
                                    <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l9-5-9-5-9 5 9 5z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Assigned Teachers"
                                value={loadingStats ? '...' : (stats?.overview.total_teachers ?? teachers.length)}
                                subtitle="Class educators"
                                icon={
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Active Classes"
                                value={loadingStats ? '...' : (stats?.overview.total_classes ?? classes.length)}
                                subtitle="Grade levels & class arms"
                                icon={
                                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Avg School Mastery"
                                value={loadingStats ? '...' : `${stats?.overview.avg_mastery ?? 0}%`}
                                subtitle="Across curriculum topics"
                                icon={
                                    <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                    </svg>
                                }
                            />
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* Classes Roster Quickview */}
                            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--color-border)]">
                                    <h3 className="text-base font-bold text-[var(--color-text)]">Active Class Arms</h3>
                                    <button
                                        onClick={() => setActiveTab('classes')}
                                        className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                                    >
                                        Manage Classes →
                                    </button>
                                </div>
                                {classes.length === 0 ? (
                                    <p className="text-xs text-[var(--color-muted)] py-4 text-center">No classes created yet.</p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {classes.slice(0, 5).map((c) => (
                                            <div key={c.id} className="p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-[var(--color-text)]">{c.name}</p>
                                                    <p className="text-[11px] text-[var(--color-muted)]">{c.grade_level ? `${c.grade_level} • ` : ''}{c.section || 'General'}</p>
                                                </div>
                                                <span className="px-2.5 py-1 text-xs font-black bg-[var(--color-primary-5)] text-[var(--color-primary)] rounded-lg border border-[var(--color-border)]">
                                                    {c.learner_count ?? 0} Learners
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Teachers Quickview */}
                            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--color-border)]">
                                    <h3 className="text-base font-bold text-[var(--color-text)]">Class Teachers</h3>
                                    <button
                                        onClick={() => setActiveTab('teachers')}
                                        className="text-xs font-bold text-[var(--color-primary)] hover:underline"
                                    >
                                        Manage Teachers →
                                    </button>
                                </div>
                                {teachers.length === 0 ? (
                                    <p className="text-xs text-[var(--color-muted)] py-4 text-center">No teachers assigned yet. Add one in the Teachers tab.</p>
                                ) : (
                                    <div className="space-y-2.5">
                                        {teachers.slice(0, 5).map((t) => (
                                            <div key={t.id} className="p-3 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-[var(--color-text)]">{t.name}</p>
                                                    <p className="text-[11px] text-[var(--color-muted)]">{t.email}</p>
                                                </div>
                                                <span className="px-2.5 py-1 text-xs font-bold bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
                                                    {t.classes?.length ?? 0} Classes
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Teachers */}
                {activeTab === 'teachers' && (
                    <TeachersTab
                        teachers={teachers}
                        schools={schools}
                        classes={classes}
                        loading={loadingTeachers}
                        onRefresh={fetchTeachers}
                        showToast={showToast}
                    />
                )}

                {/* Tab 3: Classes */}
                {activeTab === 'classes' && (
                    <ClassesTab
                        classes={classes}
                        schools={schools}
                        loading={loadingClasses}
                        onRefresh={fetchClasses}
                        showToast={showToast}
                    />
                )}

                {/* Tab 4: Learners */}
                {activeTab === 'learners' && (
                    <LearnersTab
                        learners={learners}
                        classes={classes}
                        schools={schools}
                        loading={loadingLearners}
                        onRefresh={fetchLearners}
                        showToast={showToast}
                    />
                )}

                {/* Tab 5: Subjects */}
                {activeTab === 'subjects' && (
                    <SubjectsTab
                        subjects={subjects}
                        classes={classes}
                        school={schools[0] || (stats as any)?.school || null}
                        loading={loadingSubjects}
                        onRefresh={fetchSubjects}
                        showToast={showToast}
                    />
                )}

                {/* Tab 6: Questions */}
                {activeTab === 'questions' && (
                    <QuestionBankTab
                        questions={questions}
                        subjects={subjects}
                        classes={classes}
                        allTopics={allTopics}
                        school={schools[0] || null}
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
    const isLoading = value === '...';
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-border)]">
                    {icon}
                </div>
            </div>
            <div>
                {isLoading ? (
                    <Skeleton variant="rounded" className="h-8 w-16 rounded-lg my-0.5" />
                ) : (
                    <p className="text-2xl font-black text-[var(--color-text)]">{value}</p>
                )}
                <p className="text-xs font-bold text-[var(--color-text)] mt-1">{label}</p>
                <p className="text-[11px] text-[var(--color-muted)] mt-0.5">{subtitle}</p>
            </div>
        </div>
    );
}
