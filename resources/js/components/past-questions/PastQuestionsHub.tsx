import React, { useState, useEffect } from 'react';
import {
    ExamMeta,
    PastQuestionItem,
    PastQuestionSubject,
    ExamSimulationResult,
} from '../../types/past-questions';
import { ExamPracticeModal } from './ExamPracticeModal';
import { ExamSimulationModal } from './ExamSimulationModal';
import { ExamResultModal } from './ExamResultModal';
import { BookOpen, Timer, Lock, ArrowRight, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { usePage } from '@inertiajs/react';
import { db } from '@/db/database';

export const PastQuestionsHub: React.FC = () => {
    const pageProps = usePage<any>().props;
    const initialIsGuest = !pageProps?.auth?.user;

    const [exams, setExams] = useState<ExamMeta[]>([]);
    const [subjects, setSubjects] = useState<PastQuestionSubject[]>([]);
    const [totalQuestions, setTotalQuestions] = useState<number>(0);
    const [isGuest, setIsGuest] = useState<boolean>(initialIsGuest);

    // Active Selection State
    const [selectedExam, setSelectedExam] = useState<string>('jamb');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');

    // Modals & Execution State
    const [activeQuestions, setActiveQuestions] = useState<PastQuestionItem[]>([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);
    const [activeMode, setActiveMode] = useState<'practice' | 'simulation' | null>(null);
    const [simulationId, setSimulationId] = useState<number | undefined>();
    // Generated on the device for every simulation, so its result can be saved even if it
    // was started offline (the server never saw the start) and is never counted twice.
    const [simulationClientId, setSimulationClientId] = useState<string | undefined>();
    const [examResult, setExamResult] = useState<ExamSimulationResult | null>(null);
    const [errorToast, setErrorToast] = useState<string | null>(null);

    useEffect(() => {
        fetchMeta();
    }, []);

    const fetchMeta = async () => {
        try {
            const res = await fetch('/api/v1/past-questions/meta');
            const data = await res.json();
            if (data.success) {
                setExams(data.data.exams || []);
                setSubjects(data.data.subjects || []);
                setTotalQuestions(data.data.total_questions || 0);
                if (pageProps?.auth?.user) {
                    setIsGuest(false);
                } else {
                    setIsGuest(data.data.is_guest ?? data.is_guest ?? true);
                }

                if (data.data.exams?.length > 0) {
                    setSelectedExam(data.data.exams[0].code);
                }

                try {
                    localStorage.setItem('cached_past_questions_meta', JSON.stringify(data.data));
                } catch {}
            }
        } catch (err) {
            console.warn('Error fetching meta online, checking local cache:', err);
            try {
                const cached = localStorage.getItem('cached_past_questions_meta');
                if (cached) {
                    const data = JSON.parse(cached);
                    setExams(data.exams || []);
                    setSubjects(data.subjects || []);
                    setTotalQuestions(data.total_questions || 0);
                    if (data.exams?.length > 0) {
                        setSelectedExam(data.exams[0].code);
                    }
                    return;
                }
            } catch {}

            // Offline fallback defaults if cache is fresh
            const defaultExams: ExamMeta[] = [
                {
                    code: 'jamb',
                    name: 'JAMB UTME',
                    fullName: 'Joint Admissions and Matriculation Board',
                    description: 'Full CBT simulation with authentic JAMB scoring system.',
                    badge: 'UTME Prep',
                    color: '#10b981',
                    gradient: 'from-emerald-500 to-teal-700',
                    bgLight: 'bg-emerald-50',
                    questionCount: 400,
                    defaultDurationMinutes: 120,
                    defaultQuestionCount: 60,
                },
                {
                    code: 'waec',
                    name: 'WAEC SSCE',
                    fullName: 'West African Senior School Certificate',
                    description: 'West African Examination Council standard past questions.',
                    badge: 'SSCE Prep',
                    color: '#3b82f6',
                    gradient: 'from-blue-500 to-indigo-700',
                    bgLight: 'bg-blue-50',
                    questionCount: 350,
                    defaultDurationMinutes: 90,
                    defaultQuestionCount: 50,
                },
                {
                    code: 'neco',
                    name: 'NECO SSCE',
                    fullName: 'National Examinations Council',
                    description: 'National Examinations Council practice questions.',
                    badge: 'Senior High',
                    color: '#f59e0b',
                    gradient: 'from-amber-500 to-orange-700',
                    bgLight: 'bg-amber-50',
                    questionCount: 280,
                    defaultDurationMinutes: 90,
                    defaultQuestionCount: 50,
                },
            ];
            setExams(defaultExams);
            setSelectedExam('jamb');

            // Load subjects from Dexie
            db.subjects.toArray().then((dbSubs) => {
                if (dbSubs.length > 0) {
                    setSubjects(
                        dbSubs.map((s) => ({
                            id: s.id,
                            name: s.name,
                            slug: s.slug,
                            questions_count: 50,
                            available_exams: ['jamb', 'waec', 'neco'],
                        }))
                    );
                }
            }).catch(() => {});
        }
    };

    const startSession = async (mode: 'practice' | 'simulation', overrideSubject?: string) => {
        const subjectToUse = overrideSubject || selectedSubject;
        setIsLoadingQuestions(true);
        setErrorToast(null);

        try {
            const questionLimit = isGuest ? '20' : (mode === 'simulation' ? '40' : '50');
            const params = new URLSearchParams({
                exam_code: selectedExam,
                mode: mode,
                limit: questionLimit,
            });
            if (mode === 'practice') {
                params.append('include_answers', '1');
            }
            if (subjectToUse !== 'all') {
                params.append('subject', subjectToUse);
            }

            let loadedQuestions: PastQuestionItem[] = [];

            if (navigator.onLine) {
                try {
                    const res = await fetch(`/api/v1/past-questions/questions?${params.toString()}`);
                    const data = await res.json().catch(() => null);
                    if (res.ok && data?.success && data?.data && data.data.length > 0) {
                        loadedQuestions = data.data;
                        try {
                            localStorage.setItem(`cached_pq_${selectedExam}_${subjectToUse}`, JSON.stringify(data.data));
                        } catch {}
                    }
                } catch {
                    // Fall back to offline
                }
            }

            // Offline: questions saved on this device for this exam (and subject, if chosen).
            // Only real past questions are used: substituting curriculum quiz questions would
            // submit ids the server grades against different past questions.
            if (loadedQuestions.length === 0) {
                const readCache = (key: string): PastQuestionItem[] => {
                    try {
                        const cached = JSON.parse(localStorage.getItem(key) || '[]');
                        return Array.isArray(cached) ? cached : [];
                    } catch {
                        return [];
                    }
                };
                let pool = readCache(`cached_pq_${selectedExam}_${subjectToUse}`);
                if (pool.length === 0) {
                    pool = readCache(`cached_pq_${selectedExam}_all`);
                    if (subjectToUse !== 'all') {
                        pool = pool.filter((q) => q.subject?.slug === subjectToUse);
                    }
                }
                // A fresh random selection each time, like the server gives.
                loadedQuestions = [...pool]
                    .sort(() => Math.random() - 0.5)
                    .slice(0, Number(questionLimit));
            }

            if (loadedQuestions.length === 0) {
                setErrorToast(navigator.onLine
                    ? `No questions found for ${selectedExam.toUpperCase()} with the selected criteria.`
                    : `${selectedExam.toUpperCase()} questions${subjectToUse !== 'all' ? ' for this subject' : ''} aren't saved on this device yet. Connect once and they'll download automatically.`);
                setIsLoadingQuestions(false);
                return;
            }

            setActiveQuestions(loadedQuestions);

            if (mode === 'simulation') {
                const clientId = crypto.randomUUID();
                setSimulationClientId(clientId);
                setSimulationId(undefined);
                if (navigator.onLine) {
                    try {
                        const simRes = await fetch('/api/v1/past-questions/simulation/start', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                            },
                            body: JSON.stringify({
                                exam_code: selectedExam,
                                mode: 'simulation',
                                total_questions: loadedQuestions.length,
                                client_id: clientId,
                            }),
                        });
                        const simData = await simRes.json().catch(() => null);
                        if (simData?.success && simData.data.simulation_id) {
                            setSimulationId(simData.data.simulation_id);
                        }
                    } catch {
                        // Offline start: the result is saved by its client id on submit.
                    }
                }
            }

            setActiveMode(mode);
        } catch (err) {
            console.error('Error starting session:', err);
            setErrorToast('Failed to load exam questions.');
        } finally {
            setIsLoadingQuestions(false);
        }
    };

    const currentExamMeta = exams.find(e => e.code === selectedExam) || exams[0];

    // Filter subjects dynamically for the active exam body
    const filteredSubjects = React.useMemo(() => {
        return subjects.filter(s => {
            if (s.available_exams && s.available_exams.length > 0 && !s.available_exams.includes(selectedExam)) {
                return false;
            }
            return true;
        });
    }, [subjects, selectedExam]);

    // Keep selectedSubject valid when exam changes
    const handleSelectExam = (examCode: string) => {
        setSelectedExam(examCode);

        if (selectedSubject !== 'all') {
            const subjectObj = subjects.find(s => s.slug === selectedSubject);
            if (subjectObj && subjectObj.available_exams && !subjectObj.available_exams.includes(examCode)) {
                setSelectedSubject('all');
            }
        }
    };

    // Calculate total questions available in the current active exam
    const activeExamTotalQuestions = React.useMemo(() => {
        if (!currentExamMeta) return 0;
        return currentExamMeta.questionCount || 0;
    }, [currentExamMeta]);

    return (
        <div className="space-y-8 pb-12">
            {/* In-app Error Toast Banner */}
            {errorToast && (
                <div className="fixed top-20 right-6 z-50 max-w-md bg-[var(--color-error)] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-3 animate-fade-in border border-white/20">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1 text-xs font-semibold leading-relaxed">
                        {errorToast}
                    </div>
                    <button
                        onClick={() => setErrorToast(null)}
                        className="text-white/80 hover:text-white cursor-pointer ml-1 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Guest Preview Notice Bar (Non-Auth Users) */}
            {isGuest && (
                <div className="rounded-2xl bg-gradient-to-r from-[var(--color-primary-10)] via-[var(--color-accent-10)] to-[var(--color-primary-5)] border border-[var(--color-accent-20)] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
                    <div className="flex items-start gap-3.5">
                        <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                            <Lock className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--color-accent)]">
                                    Guest Preview Mode
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--color-accent-20)] text-[var(--color-accent)] border border-[var(--color-accent)]/30">
                                    20 Free Questions
                                </span>
                            </div>
                            <p className="text-xs text-[var(--color-text)] font-medium leading-relaxed">
                                You are exploring a <strong>20-question free trial</strong>. Sign in for unrestricted access to all examination years, full-length timed CBT simulations, and AI diagnostic score tracking.
                            </p>
                        </div>
                    </div>

                    <a
                        href="/login"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs shrink-0 transition-all shadow-sm hover:shadow-md cursor-pointer self-stretch sm:self-auto justify-center"
                    >
                        <span>Sign In for Full Access</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                </div>
            )}

            {/* Hero Header Banner */}
            <div className="relative rounded-3xl overflow-hidden bg-[var(--color-primary)] p-6 md:p-10 text-white shadow-xl">
                <div className="relative z-10 max-w-3xl space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 backdrop-blur-xs border border-white/15">
                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse"></span>
                        National Exam Simulation Engine
                    </div>
                    <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
                        Past Questions & CBT Hub
                    </h1>
                    <p className="text-white/80 text-sm md:text-base leading-relaxed">
                        Authentic examination papers for <strong>JAMB/UTME</strong>, <strong>WAEC (WASSCE)</strong>, <strong>NECO</strong>, and <strong>Post-UTME</strong>. All years are unified into a comprehensive question bank with instant step-by-step AI working.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2 text-xs font-bold">
                        <div className="flex items-center gap-1.5 bg-black/20 px-3.5 py-1.5 rounded-xl border border-white/10">
                            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {totalQuestions.toLocaleString()} Verified Questions
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/20 px-3.5 py-1.5 rounded-xl border border-white/10">
                            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Step-by-Step AI Solutions
                        </div>
                        <div className="flex items-center gap-1.5 bg-black/20 px-3.5 py-1.5 rounded-xl border border-white/10">
                            <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Realistic Timed CBT Simulation
                        </div>
                    </div>
                </div>
            </div>

            {/* Exam Body Selector Tabs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {exams.map((exam) => {
                    const isSelected = selectedExam === exam.code;

                    return (
                        <button
                            key={exam.code}
                            type="button"
                            onClick={() => handleSelectExam(exam.code)}
                            className={`p-4 md:p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                                isSelected
                                    ? 'bg-[var(--color-surface)] border-[var(--color-primary)] ring-2 ring-[var(--color-primary-20)] shadow-md'
                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:bg-[var(--color-surface-hover)]'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-1.5 mb-2 min-w-0">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border shrink leading-tight truncate max-w-[65%] ${
                                    isSelected
                                        ? 'bg-[var(--color-primary)] text-white border-transparent'
                                        : 'bg-[var(--color-surface-hover)] text-[var(--color-muted)] border-[var(--color-border)]'
                                }`}>
                                    {exam.badge}
                                </span>
                                <span className="text-[11px] sm:text-xs font-bold text-[var(--color-muted)] shrink-0 whitespace-nowrap pt-0.5">
                                    {exam.questionCount.toLocaleString()} Qs
                                </span>
                            </div>

                            <h3 className="text-base font-bold text-[var(--color-text)]">
                                {exam.name}
                            </h3>
                            <p className="text-xs text-[var(--color-muted)] line-clamp-2 mt-1 leading-normal">
                                {exam.description}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Filters Bar: Subject & Unified Practice Mode Selection */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                    {/* Subject Filter */}
                    <div className="flex flex-col xs:flex-row xs:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <label className="text-[10px] font-extrabold uppercase text-[var(--color-muted)] tracking-wider shrink-0">
                            Select Subject:
                        </label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            aria-label="Filter past questions by subject"
                            className="px-3.5 py-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary-20)] focus:outline-none w-full sm:w-auto sm:min-w-[220px]"
                        >
                            <option value="all">
                                All Subjects ({activeExamTotalQuestions.toLocaleString()} Qs)
                            </option>
                            {filteredSubjects.map(s => {
                                const count = s.counts_by_exam?.[selectedExam] || s.questions_count || 0;
                                return (
                                    <option key={s.id} value={s.slug}>
                                        {s.name} ({count} Qs)
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Unified Question Bank Indicator */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] text-xs font-bold text-[var(--color-primary)] self-start sm:self-auto">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>Unified Multi-Year Question Pool</span>
                    </div>
                </div>

                {/* Active Filter Summary Feedback Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] text-xs leading-relaxed">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold uppercase text-[9px] tracking-wider text-[var(--color-muted)] shrink-0">Active Exam:</span>
                        <span className="font-bold text-[var(--color-primary)] shrink-0">{currentExamMeta?.name}</span>
                        <span className="text-[var(--color-muted)]">•</span>
                        <span className="font-bold text-[var(--color-text)] shrink-0">
                            {selectedSubject === 'all' ? 'All Core Subjects' : subjects.find(s => s.slug === selectedSubject)?.name}
                        </span>
                        <span className="text-[var(--color-muted)] hidden sm:inline">•</span>
                        <span className="font-medium text-[var(--color-muted)] text-[11px] sm:text-xs">
                            Continuous practice across all authentic past examination years
                        </span>
                    </div>
                    <span className="font-bold text-[var(--color-muted)] text-[11px] shrink-0">
                        {filteredSubjects.length} {filteredSubjects.length === 1 ? 'subject' : 'subjects'} available
                    </span>
                </div>

                {/* Mode Action Cards with First-Time Candidate Guidance (Jordan) */}
                <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs text-[var(--color-muted)] px-1">
                        <span className="font-bold flex items-center gap-1.5 text-[var(--color-text)]">
                            <HelpCircle className="w-4 h-4 text-[var(--color-primary)]" />
                            Choose Your Preparation Mode:
                        </span>
                        <span className="hidden sm:inline text-[11px]">
                            Not sure? Use <strong>Practice</strong> to learn concepts, <strong>Simulation</strong> for mock exam drill.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Practice Mode */}
                        <div className="p-5 rounded-2xl bg-[var(--color-accent-5)] border border-[var(--color-accent-20)] flex flex-col justify-between space-y-4 hover:border-[var(--color-accent)] transition-all">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-[var(--color-accent-10)] text-[var(--color-accent)]">
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-sm text-[var(--color-text)]">
                                            Interactive Practice Mode
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]">
                                        Untimed · Study
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                    Low-stress, self-paced learning designed for concept mastery and step-by-step revision.
                                </p>

                                {/* Checklist */}
                                <ul className="space-y-2 text-xs text-[var(--color-text)] pt-1">
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
                                        <span><strong>Instant feedback:</strong> See correct answers and full working immediately</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
                                        <span><strong>AI Tutor hints:</strong> Step-by-step solutions with mathematical formulas</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
                                        <span><strong>Zero time pressure:</strong> Take as much time as you need per question</span>
                                    </li>
                                </ul>
                            </div>
                            <button
                                disabled={isLoadingQuestions || filteredSubjects.length === 0}
                                onClick={() => startSession('practice')}
                                className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                            >
                                {isLoadingQuestions ? 'Loading Questions...' : 'Start Practice Mode (Untimed)'}
                            </button>
                        </div>

                        {/* CBT Simulation */}
                        <div className="p-5 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] flex flex-col justify-between space-y-4 hover:border-[var(--color-primary)] transition-all">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                                            <Timer className="w-4 h-4" />
                                        </div>
                                        <h3 className="font-bold text-sm text-[var(--color-text)]">
                                            Timed CBT Simulation
                                        </h3>
                                    </div>
                                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                        Strict Timer · Exam Drill
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                    Authentic exam conditions mimicking official JAMB / WAEC Computer-Based Test centers.
                                </p>

                                {/* Checklist */}
                                <ul className="space-y-2 text-xs text-[var(--color-text)] pt-1">
                                    <li className="flex items-start gap-2">
                                        <AlertCircle className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                                        <span><strong>Strict countdown timer:</strong> Official duration with auto-submit</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <AlertCircle className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                                        <span><strong>Hidden answers:</strong> Zero hints or answers revealed until final submission</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                                        <span><strong>Real 1–40 Palette &amp; Hotkeys:</strong> Numbered status grid and diagnostics report</span>
                                    </li>
                                </ul>
                            </div>
                            <button
                                disabled={isLoadingQuestions || filteredSubjects.length === 0}
                                onClick={() => startSession('simulation')}
                                className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-[0.99]"
                            >
                                {isLoadingQuestions ? 'Preparing CBT...' : 'Launch Timed CBT Simulation'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subject Quick Launch Grid */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[var(--color-text)]">
                        Browse by Subject ({currentExamMeta?.name || 'JAMB'})
                    </h2>
                    <span className="text-xs font-bold text-[var(--color-muted)]">
                        {filteredSubjects.length} {filteredSubjects.length === 1 ? 'Subject' : 'Subjects'} Available
                    </span>
                </div>

                {filteredSubjects.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-center space-y-3">
                        <p className="text-sm font-bold text-[var(--color-text)]">
                            No subjects found for {currentExamMeta?.name}.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredSubjects.map((sub) => {
                            const count = sub.counts_by_exam?.[selectedExam] || sub.questions_count || 0;
                            return (
                                <div
                                    key={sub.id}
                                    className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:shadow-sm transition-all flex flex-col justify-between space-y-4"
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-bold text-sm text-[var(--color-text)]">
                                                {sub.name}
                                            </h3>
                                            <span className="text-[10px] font-extrabold uppercase text-[var(--color-primary)] bg-[var(--color-primary-5)] px-2.5 py-0.5 rounded-md border border-[var(--color-primary-20)]">
                                                {count ? `${count} Questions` : 'Past Papers'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-[var(--color-muted)] mt-1.5 leading-normal">
                                            Comprehensive multi-year question bank with step-by-step working and topic mastery.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-border)]">
                                        <button
                                            type="button"
                                            onClick={() => startSession('practice', sub.slug)}
                                            className="flex-1 py-2 rounded-xl bg-[var(--color-surface-hover)] hover:bg-[var(--color-border)] text-xs font-bold text-[var(--color-text)] transition-colors cursor-pointer text-center"
                                        >
                                            Practice
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => startSession('simulation', sub.slug)}
                                            className="flex-1 py-2 rounded-xl bg-[var(--color-primary-10)] hover:bg-[var(--color-primary)] text-xs font-bold text-[var(--color-primary)] hover:text-white transition-all cursor-pointer text-center"
                                        >
                                            CBT Test
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Active Modals */}
            {activeMode === 'practice' && (
                <ExamPracticeModal
                    questions={activeQuestions}
                    examTitle={currentExamMeta?.name || 'JAMB'}
                    subjectTitle={selectedSubject !== 'all' ? (subjects.find(s => s.slug === selectedSubject)?.name || selectedSubject) : 'All Subjects'}
                    yearTitle=""
                    onClose={() => setActiveMode(null)}
                />
            )}

            {activeMode === 'simulation' && (
                <ExamSimulationModal
                    questions={activeQuestions}
                    examCode={selectedExam}
                    examTitle={currentExamMeta?.name || 'JAMB'}
                    subjectTitle={selectedSubject !== 'all' ? (subjects.find(s => s.slug === selectedSubject)?.name || selectedSubject) : 'All Subjects'}
                    yearTitle=""
                    durationMinutes={currentExamMeta?.defaultDurationMinutes || 40}
                    simulationId={simulationId}
                    simulationClientId={simulationClientId}
                    onFinish={(result) => {
                        setActiveMode(null);
                        setExamResult(result);
                    }}
                    onCancel={() => setActiveMode(null)}
                />
            )}

            {examResult && (
                <ExamResultModal
                    result={examResult}
                    onClose={() => setExamResult(null)}
                    onRetake={() => {
                        setExamResult(null);
                        startSession('simulation');
                    }}
                />
            )}
        </div>
    );
};
