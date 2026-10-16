import React, { useEffect, useState, useMemo } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { QuestionItem, SubjectItem, TopicItem, ClassItem as AdminClassItem } from '@/types/admin';
import {
    cacheAdminSubjects,
    getCachedAdminSubjects,
    cacheAdminQuestions,
    getCachedAdminQuestions,
    cacheAdminTopics,
    getCachedAdminTopics,
    executeAdminAction,
    getCachedAdminLearners,
    getAdminAuthHeaders,
    ADMIN_DATA_CHANGED_EVENT,
} from '@/services/AdminOfflineService';
import { syncAll } from '@/services/SyncService';
import { preloadFullOfflineData } from '@/services/OfflineService';
import QuestionBankTab from '@/components/admin/QuestionBankTab';
import Pagination from '@/components/common/Pagination';
import { getGradeLevelsForTeacher } from '@/utils/format';
import {
    Skeleton,
    SkeletonStatGrid,
    SkeletonLeaderboard,
    SkeletonDistribution,
    SkeletonTable,
} from '@/components/common/Skeleton';

export interface DiagnosticTopic {
    id: number;
    name: string;
    mastery_score: number;
    questions_attempted: number;
    questions_correct: number;
    status: 'critical' | 'moderate' | 'mastered';
    indicator: string;
}

export interface RecommendedIntervention {
    topic_id: number;
    topic_name: string;
    subject_name: string;
    mastery_score: number;
    indicator: string;
    question_count: number;
    action_label: string;
    reason?: string;
}

export interface LearnerDiagnostic {
    id: string;
    name: string;
    email: string;
    level: number;
    tier: string;
    avg_mastery: number;
    has_assessment_data?: boolean;
    subject_name: string;
    topics: DiagnosticTopic[];
    recommended_intervention: RecommendedIntervention | null;
    needs_intervention?: boolean;
}

interface School {
    id: number;
    name: string;
    slug: string;
    category?: string | null;
    category_ids?: number[] | null;
    allowed_grade_levels?: string[] | null;
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
    struggling_learners: LearnerDiagnostic[];
    classes: { id: number; name: string; learner_count: number }[];
}

interface Props {
    school: School | null;
    classes: ClassItem[];
    selectedClass: number | null;
}

const defaultStats: Stats = {
    overview: {
        total_learners: 0,
        total_attempted: 0,
        total_correct: 0,
        avg_mastery: 0,
        total_attempts: 0,
        avg_score: 0,
        best_score: 0,
    },
    top_performers: [],
    struggling_learners: [],
    classes: [],
};

const toArray = <T,>(val: any): T[] => {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object') return Object.values(val) as T[];
    return [];
};

export default function Dashboard({ school, classes, selectedClass }: Props) {
    const [stats, setStats] = useState<Stats>(defaultStats);
    const [loading, setLoading] = useState(true);
    const [showLearnerModal, setShowLearnerModal] = useState(false);
    const [learnerForm, setLearnerForm] = useState({
        name: '',
        email: '',
        password: '',
        school_id: school?.id ? String(school.id) : '',
        class_id: '',
        student_id: '',
        grade_level: '',
    });
    const [savingLearner, setSavingLearner] = useState(false);

    const { url } = usePage();

    const parseTabFromUrl = (targetUrl?: string): 'overview' | 'learners' | 'top' | 'struggling' | 'questions' => {
        if (typeof window === 'undefined') return 'overview';
        const rawSearch = targetUrl && targetUrl.includes('?') ? targetUrl.split('?')[1] : window.location.search;
        const tab = new URLSearchParams(rawSearch).get('tab');
        if (tab && ['overview', 'learners', 'top', 'struggling', 'questions'].includes(tab)) {
            return tab as any;
        }
        return 'overview';
    };

    const [activeTab, setActiveTab] = useState<'overview' | 'learners' | 'top' | 'struggling' | 'questions'>(() => parseTabFromUrl());

    useEffect(() => {
        setActiveTab(parseTabFromUrl(url));
    }, [url]);

    useEffect(() => {
        const handlePopState = () => {
            setActiveTab(parseTabFromUrl());
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleTabChange = (key: 'overview' | 'learners' | 'top' | 'struggling' | 'questions') => {
        setActiveTab(key);
        if (typeof window !== 'undefined') {
            const urlObj = new URL(window.location.href);
            if (key === 'overview') {
                urlObj.searchParams.delete('tab');
            } else {
                urlObj.searchParams.set('tab', key);
            }
            window.history.replaceState({}, '', urlObj.toString());
            window.dispatchEvent(new Event('urlchange'));
        }
    };

    const [strugglingPage, setStrugglingPage] = useState(1);

    // Safe normalized arrays
    const topPerformers = useMemo(() => toArray<Learner>(stats?.top_performers), [stats?.top_performers]);
    const strugglingLearners = useMemo(() => toArray<LearnerDiagnostic>(stats?.struggling_learners), [stats?.struggling_learners]);

    // Question Bank States
    const [questions, setQuestions] = useState<QuestionItem[]>([]);
    const [loadingQuestions, setLoadingQuestions] = useState(false);
    const [subjects, setSubjects] = useState<SubjectItem[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(false);
    const [allTopics, setAllTopics] = useState<TopicItem[]>([]);

    // Intervention assignment state
    const [assigningMap, setAssigningMap] = useState<Record<string, 'loading' | 'assigned'>>({});
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [selectedLearnerDiagnostic, setSelectedLearnerDiagnostic] = useState<LearnerDiagnostic | null>(null);
    const [openDropdownLearnerId, setOpenDropdownLearnerId] = useState<string | null>(null);
    const [dropdownCoords, setDropdownCoords] = useState<{ top?: number; bottom?: number; right: number } | null>(null);

    useEffect(() => {
        if (!openDropdownLearnerId) return;
        const handleClose = () => {
            setOpenDropdownLearnerId(null);
            setDropdownCoords(null);
        };
        window.addEventListener('scroll', handleClose, true);
        window.addEventListener('resize', handleClose);
        return () => {
            window.removeEventListener('scroll', handleClose, true);
            window.removeEventListener('resize', handleClose);
        };
    }, [openDropdownLearnerId]);

    const teacherSubjects = useMemo(() => {
        if (!selectedClass) return subjects;
        return subjects.filter((s) => s.class_id === selectedClass);
    }, [subjects, selectedClass]);

    const teacherTopics = useMemo(() => {
        if (!selectedClass) return allTopics;
        return allTopics.filter((t) => {
            const sub = subjects.find((s) => s.id === t.subject_id);
            return (sub?.class_id === selectedClass) || (t.subject?.class_id === selectedClass);
        });
    }, [allTopics, subjects, selectedClass]);

    const teacherQuestions = useMemo(() => {
        if (!selectedClass) return questions;
        return questions.filter((q) => {
            const matchingSubj = subjects.find((s) => s.id === q.topic?.subject?.id);
            const subjClassId = q.topic?.subject?.class_id ?? matchingSubj?.class_id;
            return subjClassId === selectedClass;
        });
    }, [questions, subjects, selectedClass]);

    const paginatedStrugglingLearners = useMemo(() => {
        return strugglingLearners.slice((strugglingPage - 1) * 50, strugglingPage * 50);
    }, [strugglingLearners, strugglingPage]);

    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = async (forceRefresh = false) => {
        if (forceRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        try {
            const params = new URLSearchParams();
            if (selectedClass) params.set('class_id', String(selectedClass));
            if (forceRefresh) params.set('refresh', '1');
            const qs = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`/api/v1/teacher/stats${qs}`, {
                headers: getAdminAuthHeaders(),
                credentials: 'include',
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.overview) {
                    setStats({
                        ...data,
                        top_performers: toArray<Learner>(data.top_performers),
                        struggling_learners: toArray<LearnerDiagnostic>(data.struggling_learners),
                        classes: toArray<AdminClassItem>(data.classes),
                    });
                    try {
                        localStorage.setItem(`cached_teacher_stats_${selectedClass || 'all'}`, JSON.stringify(data));
                    } catch {}
                }
            }
        } catch (e) {
            console.warn('Failed to load teacher stats online, checking local cache:', e);
            try {
                const cached = localStorage.getItem(`cached_teacher_stats_${selectedClass || 'all'}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    setStats({
                        ...data,
                        top_performers: toArray<Learner>(data.top_performers),
                        struggling_learners: toArray<LearnerDiagnostic>(data.struggling_learners),
                        classes: toArray<AdminClassItem>(data.classes),
                    });
                }
            } catch {}
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleManualRefresh = async () => {
        await fetchStats(true);
        if (navigator.onLine) {
            preloadFullOfflineData('teacher', true);
        }
        setToastMessage({
            text: 'Dashboard statistics refreshed & offline pack updated!',
            type: 'success',
        });
    };

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
        setStrugglingPage(1);
        fetchStats();
        fetchSubjects();
        fetchQuestions();

        const handleDataChange = () => {
            fetchStats();
            fetchSubjects();
            fetchQuestions();
        };

        const handleOnline = () => {
            syncAll().then(() => {
                fetchStats(true);
                fetchSubjects();
                fetchQuestions();
                preloadFullOfflineData('teacher', true);
            });
        };

        window.addEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
        window.addEventListener('app:sync-completed', handleDataChange);
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
            window.removeEventListener('app:sync-completed', handleDataChange);
            window.removeEventListener('online', handleOnline);
        };
    }, [selectedClass]);

    useEffect(() => {
        if (!toastMessage) return;
        const timer = setTimeout(() => setToastMessage(null), 5000);
        return () => clearTimeout(timer);
    }, [toastMessage]);

    const selectClass = (classId: number | null) => {
        router.get('/teacher/dashboard', { class_id: classId }, { preserveState: true, replace: true });
    };

    const handleOpenAddLearner = () => {
        const defaultClassId = selectedClass ? String(selectedClass) : (classes[0]?.id ? String(classes[0].id) : '');
        const matchedClass = classes.find((c) => String(c.id) === defaultClassId);
        const defaultGrade = matchedClass?.grade_level || classes[0]?.grade_level || 'SS 1';
        setLearnerForm({
            name: '',
            email: '',
            password: '',
            school_id: school?.id ? String(school.id) : '',
            class_id: defaultClassId,
            student_id: '',
            grade_level: defaultGrade,
        });
        setShowLearnerModal(true);
    };

    const handleSaveLearner = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingLearner(true);

        try {
            const tempId = `temp_${Date.now()}`;
            const selectedClassObj = classes.find((c) => String(c.id) === String(learnerForm.class_id));
            const optimisticLearner = {
                id: tempId,
                name: learnerForm.name,
                email: learnerForm.email,
                school_id: school?.id ? Number(school.id) : undefined,
                class_id: learnerForm.class_id ? Number(learnerForm.class_id) : null,
                class_name: selectedClassObj?.name,
                grade_level: learnerForm.grade_level,
                student_id: learnerForm.student_id,
                xp: 0,
                level: 1,
                streak: 0,
                mastery_percentage: 0,
                overall_accuracy: 0,
                _pendingSync: true,
            };

            const payload = {
                ...learnerForm,
                school_id: school?.id || learnerForm.school_id,
            };

            const res = await executeAdminAction({
                table: 'adminLearners',
                action: 'insert',
                recordId: tempId,
                endpoint: '/api/v1/teacher/learners',
                method: 'POST',
                payload,
                optimisticRecord: optimisticLearner,
            });

            if (res.success) {
                setToastMessage({
                    text: res.offline
                        ? `Learner ${learnerForm.name} saved offline! Will sync when connection is restored.`
                        : res.message || `Learner ${learnerForm.name} enrolled successfully!`,
                    type: 'success',
                });
                setShowLearnerModal(false);
                fetchStats(true);
            } else {
                setToastMessage({
                    text: res.error || 'Failed to enroll learner',
                    type: 'error',
                });
            }
        } catch (err: any) {
            console.error('Failed to save learner', err);
            setToastMessage({ text: err?.message || 'A network error occurred', type: 'error' });
        } finally {
            setSavingLearner(false);
        }
    };

    const handleAssignIntervention = async (learnerId: string, topicId: number, questionCount: number = 10) => {
        const key = `${learnerId}-${topicId}`;
        setAssigningMap((prev) => ({ ...prev, [key]: 'loading' }));

        try {
            const res = await executeAdminAction({
                table: 'adminQuestions',
                action: 'insert',
                recordId: `intervention_${learnerId}_${topicId}_${Date.now()}`,
                endpoint: '/api/v1/teacher/interventions/assign',
                method: 'POST',
                payload: {
                    learner_id: learnerId,
                    topic_id: topicId,
                    question_count: questionCount,
                },
            });

            if (res.success) {
                setAssigningMap((prev) => ({ ...prev, [key]: 'assigned' }));
                setToastMessage({
                    text: res.offline
                        ? `Practice assigned offline! Will sync when connection is restored.`
                        : res.message || `Sent ${questionCount} targeted practice questions to student's queue!`,
                    type: 'success',
                });
            } else {
                setAssigningMap((prev) => ({ ...prev, [key]: 'loading' }));
                setToastMessage({
                    text: res.error || 'Failed to send practice questions.',
                    type: 'error',
                });
            }
        } catch (err) {
            console.error('Intervention assignment failed', err);
            setAssigningMap((prev) => ({ ...prev, [key]: 'loading' }));
            setToastMessage({
                text: 'Network error sending practice questions. Please try again.',
                type: 'error',
            });
        }
    };

    const handleAssignAllInterventions = async () => {
        const candidates = strugglingLearners.filter((l) => l.recommended_intervention);
        if (candidates.length === 0) return;

        for (const learner of candidates) {
            if (learner.recommended_intervention) {
                await handleAssignIntervention(
                    learner.id,
                    learner.recommended_intervention.topic_id,
                    learner.recommended_intervention.question_count || 10
                );
            }
        }
        setToastMessage({
            text: `Sent targeted practice recommendations to ${candidates.length} students!`,
            type: 'success',
        });
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
        if (score >= 75) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
        if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
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

    const strugglingCount = stats?.struggling_learners?.length || 0;

    return (
        <AuthenticatedLayout
            header={
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-text)]">Teacher Dashboard</h1>
                    <p className="text-sm text-[var(--color-muted)] mt-1">{school.name}</p>
                </div>
            }
        >
            <Head>
                <title>Teacher Dashboard | AceDrill</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            {/* Toast Banner */}
            {toastMessage && (
                <div
                    className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl transition-all duration-300 ${
                        toastMessage.type === 'success'
                            ? 'bg-[var(--color-surface)] text-[var(--color-text)] border-emerald-500/40 backdrop-blur-md shadow-emerald-950/20'
                            : 'bg-[var(--color-surface)] text-[var(--color-text)] border-rose-500/40 backdrop-blur-md shadow-rose-950/20'
                    }`}
                >
                    <div className={`w-2.5 h-2.5 rounded-full ${toastMessage.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <p className="text-sm font-medium">{toastMessage.text}</p>
                    <button
                        onClick={() => setToastMessage(null)}
                        className="ml-2 text-xs opacity-60 hover:opacity-100 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {loading ? (
                <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <Skeleton variant="rounded" className="h-10 w-72 rounded-2xl" />
                        <Skeleton variant="rounded" className="h-10 w-48 rounded-xl" />
                    </div>
                    <SkeletonStatGrid count={4} cols="grid-cols-2 lg:grid-cols-4" />
                    <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                            <Skeleton variant="text" className="h-5 w-48" />
                            <SkeletonDistribution count={4} />
                        </div>
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-sm space-y-4">
                            <Skeleton variant="text" className="h-5 w-40" />
                            <SkeletonLeaderboard count={3} />
                        </div>
                    </div>
                </div>
            ) : stats ? (
                <>
                    {/* Single Unified Navigation & Class Filter Bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                        {/* Navigation Tabs */}
                        <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-1.5 shadow-xs overflow-x-auto max-w-full no-scrollbar">
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
                                    key: 'struggling' as const,
                                    label: `Targeted Practice (${strugglingCount})`,
                                    highlight: strugglingCount > 0,
                                    icon: (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    ),
                                },
                                {
                                    key: 'learners' as const,
                                    label: 'Class Roster',
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
                                    onClick={() => handleTabChange(tab.key)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap ${
                                        activeTab === tab.key
                                            ? 'bg-[var(--color-primary)] text-white shadow-xs'
                                            : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                    }`}
                                >
                                    {tab.icon}
                                    <span>{tab.label}</span>
                                    {tab.highlight && (
                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Right Controls: Refresh Live Data Button & Class Selector Dropdown */}
                        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                            <button
                                type="button"
                                onClick={handleManualRefresh}
                                disabled={refreshing || loading}
                                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[var(--color-surface)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] hover:text-[var(--color-primary-light)] border border-[var(--color-border)] hover:border-[var(--color-primary-20)] text-xs font-bold shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50 active:scale-95"
                                title="Refresh live statistics directly from server"
                            >
                                <svg
                                    className={`w-3.5 h-3.5 text-[var(--color-primary)] ${refreshing ? 'animate-spin' : ''}`}
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                {/* <span>{refreshing ? 'Refreshing...' : 'Refresh Live'}</span> */}
                            </button>

                            {/* Class Selector Dropdown */}
                            <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl px-3.5 py-1.5 shadow-xs shrink-0 max-w-full">
                                <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <span className="text-xs font-bold text-[var(--color-muted)] shrink-0">Class:</span>
                                <select
                                    value={selectedClass || ''}
                                    onChange={(e) => selectClass(e.target.value ? Number(e.target.value) : null)}
                                    className="bg-transparent text-xs font-bold text-[var(--color-text)] focus:outline-none cursor-pointer py-1 pr-2 max-w-[160px] sm:max-w-none truncate"
                                >
                                    <option value="" className="bg-[var(--color-surface)] text-[var(--color-text)]">
                                        All Classes ({stats.overview.total_learners})
                                    </option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                                            {cls.name} ({cls.learner_count})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Overview Stat Cards (Shown on Overview tab) */}
                    {activeTab === 'overview' && (
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
                                    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Students Needing Practice"
                                value={strugglingCount}
                                badge={strugglingCount > 0 ? `${strugglingCount} Ready` : undefined}
                                icon={
                                    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                }
                            />
                            <StatCard
                                label="Questions Answered"
                                value={stats.overview.total_attempted.toLocaleString()}
                                icon={
                                    <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                }
                            />
                        </div>
                    )}

                    {/* TAB: OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            {/* Targeted Practice Highlight Banner */}
                            {strugglingLearners.length > 0 && (
                                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-sm relative overflow-hidden">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                                    Diagnostic Recommendations
                                                </span>
                                                <span className="text-xs text-[var(--color-muted)]">
                                                    {strugglingLearners.length} students recommended for targeted practice
                                                </span>
                                            </div>
                                            <h2 className="text-lg font-black text-[var(--color-text)]">
                                                Targeted Practice Recommendations
                                            </h2>
                                            <p className="text-xs text-[var(--color-muted)] max-w-xl">
                                                The diagnostic engine identifies specific topics where students can boost their mastery. "Send Practice to All" queues 10 tailored review questions directly into each student's daily revision deck.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleAssignAllInterventions}
                                                className="px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2"
                                                title="Send 10 targeted practice questions on focus topics to all students"
                                            >
                                                <span>Send Practice to All ({strugglingLearners.length})</span>
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('struggling')}
                                                className="px-4 py-2.5 bg-[var(--color-surface-hover)] text-[var(--color-text)] font-semibold text-xs rounded-xl border border-[var(--color-border)] transition-colors cursor-pointer"
                                            >
                                                Review Student Topics →
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Top Performers Mini */}
                                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                    <h3 className="text-base font-bold text-[var(--color-text)] mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                        </svg>
                                        <span>Top Performers</span>
                                    </h3>
                                    {topPerformers.length === 0 ? (
                                        <p className="text-[var(--color-muted)] text-sm">No learner XP data yet</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {topPerformers.slice(0, 5).map((p, i) => (
                                                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-background)] transition-colors">
                                                    <span className="w-6 h-6 rounded-full bg-[var(--color-primary-5)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] flex items-center justify-center">
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-[var(--color-text)] truncate">{p.name}</p>
                                                        <p className="text-xs text-[var(--color-muted)]">Lv.{p.level} {p.tier}</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                                                        {p.total_xp} XP
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Urgent Interventions Preview */}
                                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                                            <svg className="w-5 h-5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span>Students Needing Practice</span>
                                        </h3>
                                        <button
                                            onClick={() => setActiveTab('struggling')}
                                            className="text-xs text-[var(--color-primary)] hover:underline font-semibold"
                                        >
                                            Review All ({strugglingLearners.length})
                                        </button>
                                    </div>
                                    {strugglingLearners.length === 0 ? (
                                        <div className="p-6 text-center text-sm text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                            All learners are on track and performing well.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {strugglingLearners.slice(0, 3).map((learner) => {
                                                const intervention = learner.recommended_intervention;
                                                const key = `${learner.id}-${intervention?.topic_id}`;
                                                const isAssigned = assigningMap[key] === 'assigned';
                                                const isLoading = assigningMap[key] === 'loading';

                                                return (
                                                    <div
                                                        key={learner.id}
                                                        className="p-3.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary-30)] transition-all"
                                                    >
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <div>
                                                                <p className="text-sm font-bold text-[var(--color-text)]">{learner.name}</p>
                                                                <p className="text-xs text-[var(--color-muted)]">
                                                                    {learner.subject_name} •{' '}
                                                                    {learner.has_assessment_data === false || learner.topics.length === 0 ? (
                                                                        <span className="text-[var(--color-muted)] italic">No assessment data yet</span>
                                                                    ) : (
                                                                        <span className="text-[var(--color-primary)] font-semibold">
                                                                            {intervention?.topic_name} ({intervention?.mastery_score}%)
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>
                                                            {learner.has_assessment_data === false || (learner.topics.length === 0 && learner.avg_mastery === 0) ? (
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                                                    <span>Awaiting Assessment</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-bold rounded-md bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                                    <span>{learner.avg_mastery}% Avg</span>
                                                                </span>
                                                            )}
                                                        </div>

                                                        {intervention && (
                                                            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
                                                                <span className="text-[11px] text-[var(--color-muted)]">
                                                                    Target: {intervention.question_count} questions
                                                                </span>
                                                                <button
                                                                    disabled={isLoading || isAssigned}
                                                                    onClick={() =>
                                                                        handleAssignIntervention(
                                                                            learner.id,
                                                                            intervention.topic_id,
                                                                            intervention.question_count
                                                                        )
                                                                    }
                                                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                        isAssigned
                                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                                            : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-xs'
                                                                    }`}
                                                                >
                                                                    {isLoading
                                                                        ? 'Sending...'
                                                                        : isAssigned
                                                                        ? 'Practice Sent'
                                                                        : 'Send Practice'}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB: STRUGGLING LEARNERS / TARGETED PRACTICE (Full View) */}
                    {activeTab === 'struggling' && (
                        <div className="space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-black text-[var(--color-text)] flex items-center gap-2">
                                            <span>Targeted Practice Recommendations</span>
                                        </h3>
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                            {strugglingLearners.length} Students Active
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--color-muted)] max-w-2xl">
                                        Calculated from student question responses. Sending practice queues 10 targeted review questions on focus topics into each student's daily revision deck.
                                    </p>
                                </div>
                                {strugglingLearners.length > 0 && (
                                    <button
                                        onClick={handleAssignAllInterventions}
                                        className="px-4 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap"
                                        title="Queues a 10-question practice set on focus topics to all students"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        <span>Send Practice to All ({strugglingLearners.length} Students)</span>
                                    </button>
                                )}
                            </div>

                            {strugglingLearners.length === 0 ? (
                                <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8">
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <h4 className="text-base font-bold text-[var(--color-text)] mb-1">
                                        All Learners Are On Track!
                                    </h4>
                                    <p className="text-xs text-[var(--color-muted)] max-w-md mx-auto">
                                        No learners currently fall below the 75% mastery intervention threshold.
                                    </p>
                                </div>
                            ) : (
                                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs min-w-[760px]">
                                            <thead>
                                                <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]/50 text-[var(--color-muted)] font-bold uppercase tracking-wider">
                                                    <th className="py-3.5 px-4">Student</th>
                                                    <th className="py-3.5 px-4">Subject</th>
                                                    <th className="py-3.5 px-4">Mastery</th>
                                                    <th className="py-3.5 px-4 min-w-[220px]">Focus Topics for Review</th>
                                                    <th className="py-3.5 px-4">Recommended Practice</th>
                                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--color-border)]">
                                                {paginatedStrugglingLearners.map((learner) => {
                                                    const intervention = learner.recommended_intervention;
                                                    const assignKey = intervention ? `${learner.id}-${intervention.topic_id}` : '';
                                                    const isAssigned = assigningMap[assignKey] === 'assigned';
                                                    const isLoading = assigningMap[assignKey] === 'loading';

                                                    const initials = learner.name
                                                        .split(' ')
                                                        .map((n) => n[0])
                                                        .join('')
                                                        .toUpperCase()
                                                        .slice(0, 2);

                                                    return (
                                                        <tr key={learner.id} className={`hover:bg-[var(--color-primary-5)]/30 transition-colors group ${openDropdownLearnerId === learner.id ? 'relative z-30' : ''}`}>
                                                            {/* Student Name & Level */}
                                                            <td className="py-4 px-4 align-top">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-black text-xs flex items-center justify-center border border-[var(--color-primary)]/20 shrink-0">
                                                                        {initials}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="font-bold text-sm text-[var(--color-text)] truncate group-hover:text-[var(--color-primary)] transition-colors">
                                                                            {learner.name}
                                                                        </p>
                                                                        <p className="text-[11px] text-[var(--color-muted)]">
                                                                            Lv.{learner.level} • {learner.tier}
                                                                        </p>
                                                                        {learner.email && (
                                                                            <p className="text-[10px] text-[var(--color-muted)] truncate max-w-[140px]">
                                                                                {learner.email}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            {/* Subject */}
                                                            <td className="py-4 px-4 align-top whitespace-nowrap">
                                                                <span className="inline-block px-2.5 py-1 rounded-lg bg-[var(--color-primary-5)] text-[var(--color-primary)] border border-[var(--color-primary-10)] font-bold text-xs uppercase tracking-wider">
                                                                    {learner.subject_name}
                                                                </span>
                                                            </td>

                                                            {/* Average Mastery */}
                                                            <td className="py-4 px-4 align-top whitespace-nowrap">
                                                                {learner.has_assessment_data === false || (learner.topics.length === 0 && learner.avg_mastery === 0) ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
                                                                        Awaiting Assessment (0%)
                                                                    </span>
                                                                ) : (
                                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                                                                        learner.avg_mastery >= 75
                                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                                            : learner.avg_mastery >= 50
                                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                                                    }`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                                                            learner.avg_mastery >= 75 ? 'bg-emerald-500' : learner.avg_mastery >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                                        }`} />
                                                                        {learner.avg_mastery}%
                                                                    </span>
                                                                )}
                                                            </td>

                                                            {/* Identified Weak Topics */}
                                                            <td className="py-4 px-4 align-top">
                                                                {learner.has_assessment_data === false || learner.topics.length === 0 ? (
                                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[11px] text-[var(--color-muted)] italic">
                                                                        No assessment data yet
                                                                    </span>
                                                                ) : (
                                                                    <div className="flex flex-wrap gap-1.5 max-w-sm">
                                                                        {learner.topics.slice(0, 3).map((topic) => (
                                                                            <span
                                                                                key={topic.id}
                                                                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text)]"
                                                                                title={`${topic.name}: ${topic.mastery_score}% mastery`}
                                                                            >
                                                                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                                    topic.mastery_score >= 75 ? 'bg-emerald-500' : topic.mastery_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                                                }`} />
                                                                                <span className="truncate max-w-[130px]">{topic.name}</span>
                                                                                <span className="font-bold shrink-0">{topic.mastery_score}%</span>
                                                                            </span>
                                                                        ))}
                                                                        {learner.topics.length > 3 && (
                                                                            <button
                                                                                onClick={() => setSelectedLearnerDiagnostic(learner)}
                                                                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
                                                                            >
                                                                                +{learner.topics.length - 3} more
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            {/* Recommended Practice Set */}
                                                            <td className="py-4 px-4 align-top">
                                                                {intervention ? (
                                                                    <div className="space-y-0.5">
                                                                        <p className="font-bold text-xs text-[var(--color-text)]">
                                                                            {intervention.topic_name}
                                                                        </p>
                                                                        <p className="text-[11px] text-[var(--color-muted)]">
                                                                            {learner.has_assessment_data === false ? 'Diagnostic Quiz' : `${intervention.question_count || 10} practice questions`}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs text-[var(--color-muted)]">None required</span>
                                                                )}
                                                            </td>

                                                            {/* Actions Dropdown */}
                                                            <td className="py-4 px-4 align-top text-right">
                                                                <div className="relative inline-block text-left">
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (openDropdownLearnerId === learner.id) {
                                                                                setOpenDropdownLearnerId(null);
                                                                                setDropdownCoords(null);
                                                                                return;
                                                                            }
                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                            const spaceBelow = window.innerHeight - rect.bottom;
                                                                            const openUp = spaceBelow < 220;

                                                                            setDropdownCoords({
                                                                                top: openUp ? undefined : rect.bottom + 6,
                                                                                bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
                                                                                right: window.innerWidth - rect.right,
                                                                            });
                                                                            setOpenDropdownLearnerId(learner.id);
                                                                        }}
                                                                        className={`p-2 rounded-xl border transition-all duration-150 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-95 ${
                                                                            openDropdownLearnerId === learner.id
                                                                                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-xs'
                                                                                : 'bg-[var(--color-surface)] hover:bg-[var(--color-primary-10)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary-20)] hover:text-[var(--color-primary-light)]'
                                                                        }`}
                                                                        title="Learner Actions"
                                                                    >
                                                                        {/* 3x3 Grid Icon */}
                                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                                            <rect x="4" y="4" width="4" height="4" rx="1" />
                                                                            <rect x="10" y="4" width="4" height="4" rx="1" />
                                                                            <rect x="16" y="4" width="4" height="4" rx="1" />
                                                                            <rect x="4" y="10" width="4" height="4" rx="1" />
                                                                            <rect x="10" y="10" width="4" height="4" rx="1" />
                                                                            <rect x="16" y="10" width="4" height="4" rx="1" />
                                                                            <rect x="4" y="16" width="4" height="4" rx="1" />
                                                                            <rect x="10" y="16" width="4" height="4" rx="1" />
                                                                            <rect x="16" y="16" width="4" height="4" rx="1" />
                                                                        </svg>
                                                                        <svg
                                                                            className={`w-3 h-3 transition-transform duration-200 ${
                                                                                openDropdownLearnerId === learner.id ? 'rotate-180' : ''
                                                                            }`}
                                                                            fill="none"
                                                                            viewBox="0 0 24 24"
                                                                            stroke="currentColor"
                                                                        >
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                                        </svg>
                                                                    </button>

                                                                    {openDropdownLearnerId === learner.id && dropdownCoords && (
                                                                        <>
                                                                            {/* Backdrop to dismiss on outside click */}
                                                                            <div
                                                                                className="fixed inset-0 z-[9998]"
                                                                                onClick={() => {
                                                                                    setOpenDropdownLearnerId(null);
                                                                                    setDropdownCoords(null);
                                                                                }}
                                                                            />

                                                                            {/* Dropdown Menu - Fixed positioning breaks out of all table/scroll bounds */}
                                                                            <div
                                                                                style={{
                                                                                    position: 'fixed',
                                                                                    top: dropdownCoords.top !== undefined ? `${dropdownCoords.top}px` : 'auto',
                                                                                    bottom: dropdownCoords.bottom !== undefined ? `${dropdownCoords.bottom}px` : 'auto',
                                                                                    right: `${dropdownCoords.right}px`,
                                                                                }}
                                                                                className="w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl z-[9999] py-1.5 overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-left"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                <div className="px-3.5 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-background)]/50">
                                                                                    <p className="text-xs font-bold text-[var(--color-text)] truncate">{learner.name}</p>
                                                                                    <p className="text-[10px] text-[var(--color-muted)] truncate">{learner.subject_name} • {learner.avg_mastery}% Mastery</p>
                                                                                </div>

                                                                                <div className="p-1 space-y-0.5">
                                                                                    {/* Action 1: View Diagnostic */}
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setSelectedLearnerDiagnostic(learner);
                                                                                            setOpenDropdownLearnerId(null);
                                                                                            setDropdownCoords(null);
                                                                                        }}
                                                                                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] flex items-center gap-2.5 transition-colors cursor-pointer group/item"
                                                                                    >
                                                                                        <span className="p-1.5 rounded-lg bg-[var(--color-primary-10)] text-[var(--color-primary)] group-hover/item:bg-[var(--color-primary)] group-hover/item:text-white transition-colors shrink-0">
                                                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                                            </svg>
                                                                                        </span>
                                                                                        <div>
                                                                                            <p className="font-bold text-xs text-[var(--color-text)]">View Details</p>
                                                                                            <p className="text-[10px] text-[var(--color-muted)]">Inspect focus topics & mastery</p>
                                                                                        </div>
                                                                                    </button>

                                                                                    {/* Action 2: Send Practice */}
                                                                                    {intervention && (
                                                                                        <button
                                                                                            type="button"
                                                                                            disabled={isLoading || isAssigned}
                                                                                            onClick={() => {
                                                                                                handleAssignIntervention(learner.id, intervention.topic_id, intervention.question_count || 10);
                                                                                                if (!isLoading) {
                                                                                                    setOpenDropdownLearnerId(null);
                                                                                                    setDropdownCoords(null);
                                                                                                }
                                                                                            }}
                                                                                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer group/item ${
                                                                                                isAssigned
                                                                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default'
                                                                                                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
                                                                                            }`}
                                                                                        >
                                                                                            <span className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                                                                                                isAssigned
                                                                                                    ? 'bg-emerald-500/20 text-emerald-500'
                                                                                                    : 'bg-amber-500/10 text-amber-500 group-hover/item:bg-amber-500 group-hover/item:text-white'
                                                                                            }`}>
                                                                                                {isLoading ? (
                                                                                                    <div className="w-3.5 h-3.5 animate-spin rounded-full border-2 border-amber-500 border-r-transparent" />
                                                                                                ) : isAssigned ? (
                                                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                                                                    </svg>
                                                                                                ) : (
                                                                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                                                                    </svg>
                                                                                                )}
                                                                                            </span>
                                                                                            <div>
                                                                                                <p className="font-bold text-xs">
                                                                                                    {isLoading ? 'Sending Practice...' : isAssigned ? 'Practice Assigned' : 'Send Practice'}
                                                                                                </p>
                                                                                                <p className="text-[10px] text-[var(--color-muted)] truncate max-w-[150px]">
                                                                                                    {intervention.topic_name} ({intervention.question_count || 10} Qs)
                                                                                                </p>
                                                                                            </div>
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {strugglingLearners.length > 0 && (
                                        <div className="border-t border-[var(--color-border)]">
                                            <Pagination
                                                currentPage={strugglingPage}
                                                totalItems={strugglingLearners.length}
                                                itemsPerPage={50}
                                                onPageChange={setStrugglingPage}
                                                itemLabel="students"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: CLASS ROSTER / LEARNERS */}
                    {activeTab === 'learners' && (
                        <ClassLearnersPanel
                            selectedClass={selectedClass}
                            getTierColor={getTierColor}
                            getMasteryColor={getMasteryColor}
                            onSelectDiagnostic={(learnerId) => {
                                const found = strugglingLearners.find((s) => s.id === learnerId);
                                if (found) setSelectedLearnerDiagnostic(found);
                            }}
                            onAddLearner={handleOpenAddLearner}
                            refreshTrigger={stats}
                        />
                    )}

                    {/* TAB: TOP PERFORMERS */}
                    {activeTab === 'top' && (
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 shadow-xs">
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-6 flex items-center gap-2">
                                <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                </svg>
                                <span>Class Leaderboard & XP Milestones</span>
                            </h3>
                            {topPerformers.length === 0 ? (
                                <p className="text-[var(--color-muted)] text-sm text-center py-8">No learners have earned XP yet</p>
                            ) : (
                                <div className="space-y-3">
                                    {topPerformers.map((p, i) => (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-4 p-4 rounded-xl border ${
                                                i === 0 ? 'bg-amber-500/10 border-amber-500/30' :
                                                i === 1 ? 'bg-slate-500/10 border-slate-500/30' :
                                                i === 2 ? 'bg-amber-700/10 border-amber-700/30' :
                                                'bg-[var(--color-surface)] border-[var(--color-border)]'
                                            }`}
                                        >
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                                                i === 0 ? 'bg-amber-500 text-black' :
                                                i === 1 ? 'bg-slate-300 text-black' :
                                                i === 2 ? 'bg-amber-700 text-white' :
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
                                            <span className="text-sm font-extrabold text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                                {p.total_xp} XP
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: QUESTION BANK */}
                    {activeTab === 'questions' && (
                        <QuestionBankTab
                            questions={teacherQuestions}
                            subjects={teacherSubjects}
                            classes={classes as unknown as AdminClassItem[]}
                            allTopics={teacherTopics}
                            school={school}
                            isTeacher={true}
                            loading={loadingQuestions || loadingSubjects}
                            onRefresh={() => {
                                fetchQuestions();
                                fetchSubjects();
                            }}
                            showToast={(text, type = 'success') => setToastMessage({ text, type })}
                        />
                    )}
                </>
            ) : (
                <p className="text-[var(--color-muted)] text-center py-16">No stats available</p>
            )}

            {/* Diagnostic Detail Modal */}
            {selectedLearnerDiagnostic && (
                <Modal onClose={() => setSelectedLearnerDiagnostic(null)} title="Learner Mastery Diagnostic">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
                            <div>
                                <h4 className="text-base font-black text-[var(--color-text)]">{selectedLearnerDiagnostic.name}</h4>
                                <p className="text-xs text-[var(--color-muted)]">
                                    Lv.{selectedLearnerDiagnostic.level} {selectedLearnerDiagnostic.tier} • {selectedLearnerDiagnostic.subject_name}
                                </p>
                            </div>
                            {selectedLearnerDiagnostic.has_assessment_data === false || (selectedLearnerDiagnostic.topics.length === 0 && selectedLearnerDiagnostic.avg_mastery === 0) ? (
                                <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                    Awaiting Assessment (0%)
                                </span>
                            ) : (
                                <span className={`px-3 py-1 text-xs font-black rounded-full border ${getMasteryColor(selectedLearnerDiagnostic.avg_mastery)}`}>
                                    {selectedLearnerDiagnostic.avg_mastery}% Overall
                                </span>
                            )}
                        </div>

                        {/* Topics Breakdown */}
                        <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)] mb-2">
                                Topic Breakdown
                            </p>
                            {selectedLearnerDiagnostic.topics.length === 0 ? (
                                <div className="p-4 text-center text-xs text-[var(--color-muted)] bg-[var(--color-background)] rounded-xl border border-[var(--color-border)] italic">
                                    No assessment data yet. Student has not completed any quizzes or practice sessions.
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {selectedLearnerDiagnostic.topics.map((t) => (
                                        <div key={t.id} className="p-2.5 bg-[var(--color-background)] rounded-xl border border-[var(--color-border)]">
                                            <div className="flex items-center justify-between mb-1 text-xs">
                                                <span className="font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                                                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${t.mastery_score >= 75 ? 'bg-emerald-500' : t.mastery_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                                    <span>{t.name}</span>
                                                </span>
                                                <span className="font-bold text-[var(--color-text)]">{t.mastery_score}%</span>
                                            </div>
                                            <div className="w-full bg-[var(--color-surface)] h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${
                                                        t.mastery_score >= 75 ? 'bg-emerald-500' : t.mastery_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                    }`}
                                                    style={{ width: `${t.mastery_score}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Intervention Action */}
                        {selectedLearnerDiagnostic.recommended_intervention && (
                            <div className="p-4 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)]">
                                <p className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1">
                                    {selectedLearnerDiagnostic.has_assessment_data === false ? 'Diagnostic Assessment' : 'Recommended Practice Set'}
                                </p>
                                <p className="text-sm font-extrabold text-[var(--color-text)]">
                                    {selectedLearnerDiagnostic.recommended_intervention.topic_name}
                                </p>
                                <p className="text-xs text-[var(--color-muted)] mt-1 mb-3">
                                    {selectedLearnerDiagnostic.has_assessment_data === false
                                        ? `Send a 10-question baseline diagnostic assessment into the student's study deck.`
                                        : `Send ${selectedLearnerDiagnostic.recommended_intervention.question_count} targeted practice questions into the student's daily revision deck.`}
                                </p>
                                <button
                                    onClick={() => {
                                        if (selectedLearnerDiagnostic.recommended_intervention) {
                                            handleAssignIntervention(
                                                selectedLearnerDiagnostic.id,
                                                selectedLearnerDiagnostic.recommended_intervention.topic_id,
                                                selectedLearnerDiagnostic.recommended_intervention.question_count
                                            );
                                            setSelectedLearnerDiagnostic(null);
                                        }
                                    }}
                                    className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                                >
                                    {selectedLearnerDiagnostic.has_assessment_data === false ? 'Send Diagnostic Assessment' : 'Send Practice Questions'}
                                </button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {/* Enroll New Learner Modal */}
            {showLearnerModal && (
                <Modal onClose={() => setShowLearnerModal(false)} title="Enroll New Learner">
                    <form onSubmit={handleSaveLearner} className="space-y-4">
                        <div>
                            <label className="block font-bold text-xs text-[var(--color-text)] mb-1">Full Name *</label>
                            <input
                                type="text"
                                required
                                value={learnerForm.name}
                                onChange={(e) => setLearnerForm({ ...learnerForm, name: e.target.value })}
                                placeholder="e.g. John Doe"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] placeholder-[var(--color-muted)]"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-xs text-[var(--color-text)] mb-1">Email Address *</label>
                            <input
                                type="email"
                                required
                                value={learnerForm.email}
                                onChange={(e) => setLearnerForm({ ...learnerForm, email: e.target.value })}
                                placeholder="learner@example.com"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] placeholder-[var(--color-muted)]"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-xs text-[var(--color-text)] mb-1">Initial Password *</label>
                            <input
                                type="password"
                                required
                                value={learnerForm.password}
                                onChange={(e) => setLearnerForm({ ...learnerForm, password: e.target.value })}
                                placeholder="Minimum 6 characters"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] placeholder-[var(--color-muted)]"
                            />
                        </div>

                        <div>
                            <label className="block font-bold text-xs text-[var(--color-text)] mb-1">School *</label>
                            <select
                                value={learnerForm.school_id || (school?.id ? String(school.id) : '')}
                                onChange={(e) => setLearnerForm({ ...learnerForm, school_id: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm font-semibold focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                            >
                                <option value={school?.id ? String(school.id) : ''}>{school?.name || 'School'}</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-xs text-[var(--color-text)] mb-1">Grade Level *</label>
                                <select
                                    value={learnerForm.grade_level}
                                    onChange={(e) => {
                                        const newGrade = e.target.value;
                                        const currentCls = classes.find((c) => String(c.id) === learnerForm.class_id);
                                        const classId = currentCls && currentCls.grade_level !== newGrade ? '' : learnerForm.class_id;
                                        setLearnerForm({ ...learnerForm, grade_level: newGrade, class_id: classId });
                                    }}
                                    className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm font-semibold focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    {(() => {
                                        const groups = getGradeLevelsForTeacher(classes, school);
                                        return groups.map((grp) => (
                                            <optgroup key={grp.group} label={grp.group} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                                                {grp.options.map((opt) => (
                                                    <option key={opt.value} value={opt.value} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ));
                                    })()}
                                </select>
                            </div>

                            <div>
                                <label className="block font-bold text-xs text-[var(--color-text)] mb-1">Assigned Class</label>
                                <select
                                    value={learnerForm.class_id}
                                    onChange={(e) => {
                                        const selectedClsId = e.target.value;
                                        const matchedCls = classes.find((c) => String(c.id) === selectedClsId);
                                        setLearnerForm({
                                            ...learnerForm,
                                            class_id: selectedClsId,
                                            grade_level: matchedCls?.grade_level || learnerForm.grade_level,
                                        });
                                    }}
                                    className="w-full px-3 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm font-semibold focus:outline-none focus:border-[var(--color-primary)] cursor-pointer"
                                >
                                    <option value="" className="bg-[var(--color-surface)] text-[var(--color-text)]">No Class (General)</option>
                                    {classes.map((cls) => (
                                        <option key={cls.id} value={cls.id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
                                            {cls.name} {cls.grade_level ? `(${cls.grade_level})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block font-bold text-xs text-[var(--color-text)] mb-1">Student ID</label>
                            <input
                                type="text"
                                value={learnerForm.student_id}
                                onChange={(e) => setLearnerForm({ ...learnerForm, student_id: e.target.value })}
                                placeholder="e.g. STU-001"
                                className="w-full px-3.5 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] text-sm focus:outline-none focus:border-[var(--color-primary)] placeholder-[var(--color-muted)]"
                            />
                        </div>

                        <div className="pt-3 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                            <button
                                type="button"
                                onClick={() => setShowLearnerModal(false)}
                                className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingLearner}
                                className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                            >
                                {savingLearner ? 'Saving...' : 'Add Learner'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </AuthenticatedLayout>
    );
}

// ── Sub-components ──

function StatCard({
    label,
    value,
    badge,
    icon,
}: {
    label: string;
    value: string | number;
    badge?: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-border)]">
                    {icon}
                </div>
                {badge && (
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {badge}
                    </span>
                )}
            </div>
            <div>
                <p className="text-2xl font-black text-[var(--color-text)]">{value}</p>
                <p className="text-xs text-[var(--color-muted)] mt-1">{label}</p>
            </div>
        </div>
    );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
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
    onSelectDiagnostic,
    onAddLearner,
    refreshTrigger,
}: {
    selectedClass: number | null;
    getTierColor: (level: number) => string;
    getMasteryColor: (score: number) => string;
    onSelectDiagnostic?: (learnerId: string) => void;
    onAddLearner?: () => void;
    refreshTrigger?: any;
}) {
    const [learners, setLearners] = useState<Learner[]>([]);
    const [className, setClassName] = useState('');
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [search, selectedClass]);

    useEffect(() => {
        if (!selectedClass) {
            setLearners([]);
            setLoading(false);
            return;
        }

        const loadLearners = async () => {
            setLoading(true);
            try {
                if (!navigator.onLine) {
                    const cached = await getCachedAdminLearners();
                    const matched = cached.filter((l: any) => String(l.class_id) === String(selectedClass));
                    setLearners(matched as any[]);
                    return;
                }
                const res = await fetch(`/api/v1/teacher/classes/${selectedClass}/learners`, {
                    headers: getAdminAuthHeaders(),
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    setLearners(data.learners || []);
                    setClassName(data.class?.name || '');
                } else {
                    const cached = await getCachedAdminLearners();
                    const matched = cached.filter((l: any) => String(l.class_id) === String(selectedClass));
                    setLearners(matched as any[]);
                }
            } catch {
                const cached = await getCachedAdminLearners();
                const matched = cached.filter((l: any) => String(l.class_id) === String(selectedClass));
                setLearners(matched as any[]);
            } finally {
                setLoading(false);
            }
        };

        loadLearners();

        const handleDataChange = () => {
            loadLearners();
        };

        window.addEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
        return () => window.removeEventListener(ADMIN_DATA_CHANGED_EVENT, handleDataChange);
    }, [selectedClass, refreshTrigger]);

    if (!selectedClass) {
        return (
            <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6">
                <p className="text-[var(--color-muted)] mb-4">Select a class to view enrolled learners</p>
                {onAddLearner && (
                    <button
                        onClick={onAddLearner}
                        className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Add Learner</span>
                    </button>
                )}
            </div>
        );
    }

    const filtered = learners.filter(
        (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase())
    );

    const paginated = filtered.slice((page - 1) * 50, page * 50);

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5 sm:mb-6">
                <h3 className="text-sm sm:text-base font-bold text-[var(--color-text)] flex items-center gap-2">
                    <svg className="w-5 h-5 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="truncate">{className} ({learners.length} Enrolled Learners)</span>
                </h3>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-56">
                        <input
                            type="text"
                            placeholder="Search learners..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
                        />
                        <span className="absolute left-3 top-2.5 text-[var(--color-muted)]">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                    </div>
                    {onAddLearner && (
                        <button
                            onClick={onAddLearner}
                            className="w-full sm:w-auto justify-center px-3.5 py-2.5 sm:py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Add Learner</span>
                        </button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="py-2">
                    <SkeletonTable rows={4} columns={6} hasHeader={false} />
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-[var(--color-muted)] text-xs text-center py-8">
                    {learners.length === 0 ? 'No learners enrolled yet. Click "+ Add Learner" to add one.' : 'No learners match your search.'}
                </p>
            ) : (
                <div className="space-y-4">
                    {/* Mobile Card List (< sm screens) */}
                    <div className="sm:hidden space-y-3">
                        {paginated.map((l) => (
                            <div
                                key={l.id}
                                className="p-3.5 bg-[var(--color-background)]/70 border border-[var(--color-border)] rounded-xl space-y-3"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-[var(--color-text)] truncate">{l.name}</p>
                                        <p className="text-[11px] text-[var(--color-muted)] truncate">{l.email}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <span className={`font-bold text-xs ${getTierColor(l.level)}`}>Lv.{l.level}</span>
                                        <span className="text-[10px] text-[var(--color-muted)] block">{l.tier}</span>
                                    </div>
                                </div>

                                {/* 3-Stat Summary Pills */}
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)]/60 text-center">
                                    <div className="bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]/40">
                                        <span className="text-[10px] text-[var(--color-muted)] block font-semibold uppercase">XP</span>
                                        <span className="text-xs font-bold text-amber-400">⚡ {l.total_xp}</span>
                                    </div>
                                    <div className="bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]/40">
                                        <span className="text-[10px] text-[var(--color-muted)] block font-semibold uppercase">Streak</span>
                                        <span className="text-xs font-bold text-amber-400">
                                            {l.streak > 0 ? `🔥 ${l.streak}d` : '-'}
                                        </span>
                                    </div>
                                    <div className="bg-[var(--color-surface)] p-2 rounded-lg border border-[var(--color-border)]/40">
                                        <span className="text-[10px] text-[var(--color-muted)] block font-semibold uppercase">Mastery</span>
                                        {l.total_attempted > 0 ? (
                                            <span className={`text-[11px] font-bold ${getMasteryColor(l.avg_mastery)}`}>
                                                {l.avg_mastery}%
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-[var(--color-muted)] font-medium">New</span>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Row: Accuracy and Diagnostic Action */}
                                <div className="flex items-center justify-between pt-1 gap-2">
                                    <div className="text-[11px] text-[var(--color-muted)]">
                                        Accuracy: <span className="font-bold text-[var(--color-text)]">{l.total_attempted > 0 ? `${Math.round((l.total_correct / l.total_attempted) * 100)}%` : '-'}</span>
                                    </div>
                                    {onSelectDiagnostic && (
                                        <button
                                            onClick={() => onSelectDiagnostic(l.id)}
                                            className="px-3 py-1.5 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] font-bold text-xs rounded-lg border border-[var(--color-primary-10)] transition-colors cursor-pointer"
                                        >
                                            Diagnostic Report →
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop / Tablet Table (>= sm screens) */}
                    <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-xs text-left min-w-[640px]">
                            <thead className="border-b border-[var(--color-border)] text-[var(--color-muted)] font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="pb-3 pr-3">Name</th>
                                    <th className="pb-3 px-3">Level</th>
                                    <th className="pb-3 px-3">XP</th>
                                    <th className="pb-3 px-3">Streak</th>
                                    <th className="pb-3 px-3">Mastery</th>
                                    <th className="pb-3 px-3">Accuracy</th>
                                    <th className="pb-3 pl-3 text-right">Diagnostic</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {paginated.map((l) => (
                                    <tr key={l.id} className="hover:bg-[var(--color-background)] transition-colors">
                                        <td className="py-3 pr-3 min-w-[160px]">
                                            <p className="font-bold text-[var(--color-text)]">{l.name}</p>
                                            <p className="text-[11px] text-[var(--color-muted)]">{l.email}</p>
                                        </td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            <span className={`font-bold ${getTierColor(l.level)}`}>Lv.{l.level}</span>
                                            <span className="text-[11px] text-[var(--color-muted)] ml-1">{l.tier}</span>
                                        </td>
                                        <td className="py-3 px-3 font-bold text-amber-400 whitespace-nowrap">{l.total_xp}</td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            {l.streak > 0 ? (
                                                <span className="text-amber-400 font-bold flex items-center gap-1">
                                                    <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.527.82-1.17 1.95-1.17 3.952 0 .57.065 1.05.158 1.474-.298-.242-.647-.532-.977-.866a1 1 0 00-1.44.095c-.822 1.002-1.394 2.37-1.394 3.791 0 3.314 2.686 6 6 6s6-2.686 6-6c0-2.434-1.206-4.524-2.355-5.941z" clipRule="evenodd" />
                                                    </svg>
                                                    <span>{l.streak}d</span>
                                                </span>
                                            ) : (
                                                <span className="text-[var(--color-muted)]">-</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            {l.total_attempted > 0 ? (
                                                <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${getMasteryColor(l.avg_mastery)}`}>
                                                    {l.avg_mastery}%
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                                    Awaiting Assessment
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 whitespace-nowrap">
                                            <span className="text-[var(--color-muted)] font-medium">
                                                {l.total_attempted > 0
                                                    ? `${Math.round((l.total_correct / l.total_attempted) * 100)}%`
                                                    : '-'}
                                            </span>
                                        </td>
                                        <td className="py-3 pl-3 text-right whitespace-nowrap">
                                            {onSelectDiagnostic && (
                                                <button
                                                    onClick={() => onSelectDiagnostic(l.id)}
                                                    className="px-2.5 py-1 bg-[var(--color-primary-5)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--color-primary)] font-bold text-[11px] rounded-lg border border-[var(--color-primary-10)] transition-colors cursor-pointer"
                                                >
                                                    View Diagnostic
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-[var(--color-border)] pt-2">
                        <Pagination
                            currentPage={page}
                            totalItems={filtered.length}
                            itemsPerPage={50}
                            onPageChange={setPage}
                            itemLabel="learners"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
