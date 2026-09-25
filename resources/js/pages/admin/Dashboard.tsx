import { useEffect, useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Stats, SchoolItem, SchoolAdminItem, TeacherItem, ClassItem, Learner, SubjectItem, QuestionItem, TopicItem } from '@/types/admin';
import {
    cacheAdminSchools,
    getCachedAdminSchools,
    cacheAdminSchoolAdmins,
    getCachedAdminSchoolAdmins,
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
    ADMIN_DATA_CHANGED_EVENT,
} from '@/services/AdminOfflineService';
import OverviewTab from '@/components/admin/OverviewTab';
import SchoolsTab from '@/components/admin/SchoolsTab';
import SchoolAdminsTab from '@/components/admin/SchoolAdminsTab';
import TeachersTab from '@/components/admin/TeachersTab';
import ClassesTab from '@/components/admin/ClassesTab';
import LearnersTab from '@/components/admin/LearnersTab';
import SubjectsTab from '@/components/admin/SubjectsTab';
import QuestionBankTab from '@/components/admin/QuestionBankTab';

export default function Dashboard() {
    const { auth } = usePage<{ auth: { user: { id: number; name: string; email: string; role: string } } }>().props;
    const [activeTab, setActiveTab] = useState<'overview' | 'schools' | 'school_admins' | 'teachers' | 'classes' | 'learners' | 'subjects' | 'questions'>('overview');
    
    // Data States
    const [stats, setStats] = useState<Stats | null>(null);
    const [loadingStats, setLoadingStats] = useState(true);
    
    const isSuperAdmin = auth?.user?.role === 'platform_admin' || (stats?.is_super_admin === true);
    
    const [schools, setSchools] = useState<SchoolItem[]>([]);
    const [loadingSchools, setLoadingSchools] = useState(false);

    const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdminItem[]>([]);
    const [loadingSchoolAdmins, setLoadingSchoolAdmins] = useState(false);

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
                const items = data.data || data.schools || [];
                const merged = await cacheAdminSchools(items);
                setSchools(merged);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading schools from offline storage:', err);
            const cached = await getCachedAdminSchools();
            setSchools(cached);
        } finally {
            setLoadingSchools(false);
        }
    };

    // Fetch School Admins (Super Admin Only)
    const fetchSchoolAdmins = async () => {
        if (!isSuperAdmin) return;
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
                const items = data.data || data.school_admins || [];
                const merged = await cacheAdminSchoolAdmins(items);
                setSchoolAdmins(merged);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading school admins from offline storage:', err);
            const cached = await getCachedAdminSchoolAdmins();
            setSchoolAdmins(cached);
        } finally {
            setLoadingSchoolAdmins(false);
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
            const res = await fetch('/api/v1/admin/teachers');
            if (res.ok) {
                const data = await res.json();
                const items = data.data || data.teachers || [];
                const merged = await cacheAdminTeachers(items);
                setTeachers(merged);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading teachers from offline storage:', err);
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
            const res = await fetch('/api/v1/admin/classes');
            if (res.ok) {
                const data = await res.json();
                const items = data.data || data.classes || [];
                const merged = await cacheAdminClasses(items);
                setClasses(merged);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading classes from offline storage:', err);
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
            const res = await fetch('/api/v1/admin/learners');
            if (res.ok) {
                const data = await res.json();
                const items = data.data || data.learners || [];
                const merged = await cacheAdminLearners(items);
                setLearners(merged);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading learners from offline storage:', err);
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
                const cached = await getCachedAdminSubjects();
                setSubjects(cached);
                const cachedTopics = await getCachedAdminTopics();
                setAllTopics(cachedTopics);
                return;
            }
            const res = await fetch('/api/v1/admin/subjects');
            if (res.ok) {
                const data = await res.json();
                const items = data.data || data.subjects || [];
                const merged = await cacheAdminSubjects(items);
                setSubjects(merged);

                const extractedTopics = items.flatMap((s: SubjectItem) => s.topics || []);
                setAllTopics(extractedTopics);
                if (extractedTopics.length > 0) {
                    await cacheAdminTopics(extractedTopics);
                }
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading subjects from offline storage:', err);
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
                const items = data.data || data.questions || [];
                const merged = await cacheAdminQuestions(items);
                setQuestions(merged);
            } else {
                throw new Error('Server error');
            }
        } catch (err) {
            console.warn('Loading questions from offline storage:', err);
            const cached = await getCachedAdminQuestions();
            setQuestions(cached);
        } finally {
            setLoadingQuestions(false);
        }
    };

    // Initial Load & Event Listener
    useEffect(() => {
        fetchStats();
        fetchSchools();
        if (isSuperAdmin) {
            fetchSchoolAdmins();
        }
        fetchTeachers();
        fetchClasses();
        fetchLearners();
        fetchSubjects();
        fetchQuestions();

        const handleDataChange = () => {
            fetchStats();
            fetchSchools();
            if (isSuperAdmin) {
                fetchSchoolAdmins();
            }
            fetchTeachers();
            fetchClasses();
            fetchLearners();
            fetchSubjects();
            fetchQuestions();
        };

        window.addEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
        return () => window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
    }, [isSuperAdmin]);

    const allTabs = [
        {
            id: 'overview' as const,
            label: 'Overview',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
            superAdminOnly: false,
        },
        {
            id: 'schools' as const,
            label: 'Schools',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            ),
            count: schools.length || undefined,
            superAdminOnly: true,
        },
        {
            id: 'school_admins' as const,
            label: 'School Admins',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            count: schoolAdmins.length || undefined,
            superAdminOnly: true,
        },
        {
            id: 'teachers' as const,
            label: 'Teachers',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
            count: teachers.length || undefined,
            superAdminOnly: false,
        },
        {
            id: 'classes' as const,
            label: 'Classes',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
            ),
            count: classes.length || undefined,
            superAdminOnly: false,
        },
        {
            id: 'learners' as const,
            label: 'Learners',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-5.824-3.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                </svg>
            ),
            count: learners.length || undefined,
            superAdminOnly: false,
        },
        {
            id: 'subjects' as const,
            label: 'Subjects',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
            ),
            count: subjects.length || undefined,
            superAdminOnly: false,
        },
        {
            id: 'questions' as const,
            label: 'Question Bank',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            count: questions.length || undefined,
            superAdminOnly: false,
        },
    ];

    const visibleTabs = allTabs.filter(tab => !tab.superAdminOnly || isSuperAdmin);

    return (
        <AuthenticatedLayout>
            <Head>
                <title>{isSuperAdmin ? "Super Admin Command Center | AILEARN" : `${stats?.school?.name || 'School'} Admin Portal | AILEARN`}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <div className="w-full space-y-5 sm:space-y-6">
                {/* Toast Notification */}
                {toast && (
                    <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all transform duration-300 ${
                        toast.type === 'success' ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-error)] text-white'
                    }`}>
                        {toast.type === 'success' ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                )}

                {/* Header Title */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-text)] flex items-center gap-3">
                            <span className="p-2 bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-border)] rounded-xl">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </span>
                            {isSuperAdmin ? 'Super Admin Command Center' : `${stats?.school?.name || 'School'} Admin Portal`}
                        </h1>
                        <p className="text-[var(--color-muted)] text-sm mt-1">
                            {isSuperAdmin 
                                ? 'Super admin platform oversight, school provisioning, admin assignment, and global curriculum management.'
                                : `School administration for ${stats?.school?.name || 'your institution'}: manage classes, learners, and learning performance.`
                            }
                        </p>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 overflow-x-auto">
                    {visibleTabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer active:scale-[0.98] whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-[var(--color-primary)] text-white shadow-sm'
                                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                            }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[var(--color-primary-5)] text-[var(--color-muted)]'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Sub-Component Tabs */}
                {activeTab === 'overview' && (
                    <OverviewTab stats={stats} loading={loadingStats} />
                )}

                {activeTab === 'schools' && isSuperAdmin && (
                    <SchoolsTab
                        schools={schools}
                        loading={loadingSchools}
                        onRefresh={() => { fetchSchools(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'school_admins' && isSuperAdmin && (
                    <SchoolAdminsTab
                        admins={schoolAdmins}
                        schools={schools}
                        loading={loadingSchoolAdmins}
                        onRefresh={() => { fetchSchoolAdmins(); fetchSchools(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'teachers' && (
                    <TeachersTab
                        teachers={teachers}
                        schools={schools}
                        classes={classes}
                        loading={loadingTeachers}
                        onRefresh={() => { fetchTeachers(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'classes' && (
                    <ClassesTab
                        classes={classes}
                        schools={schools}
                        loading={loadingClasses}
                        onRefresh={() => { fetchClasses(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'learners' && (
                    <LearnersTab
                        learners={learners}
                        schools={schools}
                        classes={classes}
                        loading={loadingLearners}
                        onRefresh={() => { fetchLearners(); fetchClasses(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'subjects' && (
                    <SubjectsTab
                        subjects={subjects}
                        classes={classes}
                        loading={loadingSubjects}
                        onRefresh={() => { fetchSubjects(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}

                {activeTab === 'questions' && (
                    <QuestionBankTab
                        questions={questions}
                        subjects={subjects}
                        classes={classes}
                        allTopics={allTopics}
                        school={schools[0] || (stats?.school as any) || null}
                        loading={loadingQuestions}
                        onRefresh={() => { fetchQuestions(); fetchStats(); }}
                        showToast={showToast}
                    />
                )}
            </div>
        </AuthenticatedLayout>
    );
}
