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
import { BookOpen, Timer } from 'lucide-react';

export const PastQuestionsHub: React.FC = () => {
    const [exams, setExams] = useState<ExamMeta[]>([]);
    const [subjects, setSubjects] = useState<PastQuestionSubject[]>([]);
    const [totalQuestions, setTotalQuestions] = useState<number>(0);

    // Active Selection State
    const [selectedExam, setSelectedExam] = useState<string>('jamb');
    const [selectedSubject, setSelectedSubject] = useState<string>('all');

    // Modals & Execution State
    const [activeQuestions, setActiveQuestions] = useState<PastQuestionItem[]>([]);
    const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);
    const [activeMode, setActiveMode] = useState<'practice' | 'simulation' | null>(null);
    const [simulationId, setSimulationId] = useState<number | undefined>();
    const [examResult, setExamResult] = useState<ExamSimulationResult | null>(null);

    // History
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetchMeta();
        fetchHistory();
    }, []);

    const fetchMeta = async () => {
        try {
            const res = await fetch('/api/v1/past-questions/meta');
            const data = await res.json();
            if (data.success) {
                setExams(data.data.exams || []);
                setSubjects(data.data.subjects || []);
                setTotalQuestions(data.data.total_questions || 0);

                if (data.data.exams?.length > 0) {
                    setSelectedExam(data.data.exams[0].code);
                }
            }
        } catch (err) {
            console.error('Failed to fetch past questions metadata:', err);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/v1/past-questions/history');
            const data = await res.json();
            if (data.success) {
                setHistory(data.data || []);
            }
        } catch (err) {
            console.error('Failed to fetch past questions history:', err);
        }
    };

    const startSession = async (mode: 'practice' | 'simulation', overrideSubject?: string) => {
        const subjectToUse = overrideSubject || selectedSubject;
        setIsLoadingQuestions(true);

        try {
            const params = new URLSearchParams({
                exam_code: selectedExam,
                limit: mode === 'simulation' ? '40' : '50',
            });
            if (subjectToUse !== 'all') {
                params.append('subject', subjectToUse);
            }

            const res = await fetch(`/api/v1/past-questions/questions?${params.toString()}`);
            const data = await res.json();

            if (!data.success || !data.data || data.data.length === 0) {
                alert(`No questions found for ${selectedExam.toUpperCase()} with the selected subject.`);
                setIsLoadingQuestions(false);
                return;
            }

            setActiveQuestions(data.data);

            if (mode === 'simulation') {
                const simRes = await fetch('/api/v1/past-questions/simulation/start', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        exam_code: selectedExam,
                        mode: 'simulation',
                        total_questions: data.data.length,
                    }),
                });
                const simData = await simRes.json();
                if (simData.success) {
                    setSimulationId(simData.data.simulation_id);
                }
            }

            setActiveMode(mode);
        } catch (err) {
            console.error('Error starting session:', err);
            alert('Failed to load exam questions.');
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
                            <div className="flex items-center justify-between mb-2">
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border ${
                                    isSelected
                                        ? 'bg-[var(--color-primary)] text-white border-transparent'
                                        : 'bg-[var(--color-surface-hover)] text-[var(--color-muted)] border-[var(--color-border)]'
                                }`}>
                                    {exam.badge}
                                </span>
                                <span className="text-xs font-bold text-[var(--color-muted)]">
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
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Subject Filter */}
                    <div className="flex items-center gap-3">
                        <label className="text-[10px] font-extrabold uppercase text-[var(--color-muted)] tracking-wider shrink-0">
                            Select Subject:
                        </label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            aria-label="Filter past questions by subject"
                            className="px-3.5 py-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-xs font-bold text-[var(--color-text)] focus:ring-2 focus:ring-[var(--color-primary-20)] focus:outline-none min-w-[200px]"
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
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] text-xs font-bold text-[var(--color-primary)]">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span>Unified Multi-Year Question Pool</span>
                    </div>
                </div>

                {/* Active Filter Summary Feedback Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold uppercase text-[9px] tracking-wider text-[var(--color-muted)]">Active Exam:</span>
                        <span className="font-bold text-[var(--color-primary)]">{currentExamMeta?.name}</span>
                        <span className="text-[var(--color-muted)]">•</span>
                        <span className="font-bold text-[var(--color-text)]">
                            {selectedSubject === 'all' ? 'All Core Subjects' : subjects.find(s => s.slug === selectedSubject)?.name}
                        </span>
                        <span className="text-[var(--color-muted)]">•</span>
                        <span className="font-medium text-[var(--color-muted)]">
                            Continuous practice across all authentic past examination years
                        </span>
                    </div>
                    <span className="font-bold text-[var(--color-muted)]">
                        {filteredSubjects.length} {filteredSubjects.length === 1 ? 'subject' : 'subjects'} available
                    </span>
                </div>

                {/* Mode Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    {/* Practice Mode */}
                    <div className="p-5 rounded-2xl bg-[var(--color-accent-5)] border border-[var(--color-accent-20)] flex flex-col justify-between space-y-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-[var(--color-accent-10)] text-[var(--color-accent)]">
                                    <BookOpen className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-sm text-[var(--color-text)]">
                                    Interactive Practice Mode
                                </h3>
                            </div>
                            <p className="text-xs text-[var(--color-muted)] mt-1.5 leading-relaxed">
                                Self-paced learning with instant correct/wrong feedback, topic mastery, and step-by-step AI working for every question.
                            </p>
                        </div>
                        <button
                            disabled={isLoadingQuestions || filteredSubjects.length === 0}
                            onClick={() => startSession('practice')}
                            className="w-full py-2.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                            {isLoadingQuestions ? 'Loading Questions...' : 'Start Practice Mode'}
                        </button>
                    </div>

                    {/* CBT Simulation */}
                    <div className="p-5 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] flex flex-col justify-between space-y-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-[var(--color-primary-10)] text-[var(--color-primary)]">
                                    <Timer className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-sm text-[var(--color-text)]">
                                    Timed CBT Simulation
                                </h3>
                            </div>
                            <p className="text-xs text-[var(--color-muted)] mt-1.5 leading-relaxed">
                                Standard timed exam conditions with question palette, calculator, countdown timer, and weak-topic scorecard.
                            </p>
                        </div>
                        <button
                            disabled={isLoadingQuestions || filteredSubjects.length === 0}
                            onClick={() => startSession('simulation')}
                            className="w-full py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                        >
                            {isLoadingQuestions ? 'Preparing CBT...' : 'Launch Timed CBT Simulation'}
                        </button>
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

            {/* Past Attempts History */}
            {history.length > 0 && (
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 shadow-xs space-y-4">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">
                        Recent Exam Simulation History
                    </h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead>
                                <tr className="border-b border-[var(--color-border)] text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider">
                                    <th className="pb-3">Examination</th>
                                    <th className="pb-3">Score</th>
                                    <th className="pb-3">Questions</th>
                                    <th className="pb-3">Time Taken</th>
                                    <th className="pb-3">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                                {history.map((item) => (
                                    <tr key={item.id} className="text-xs text-[var(--color-text)]">
                                        <td className="py-3 font-bold uppercase text-[var(--color-primary)]">
                                            {item.exam_code} {item.exam_year || ''}
                                        </td>
                                        <td className="py-3">
                                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${
                                                item.score_percentage >= 70
                                                    ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]'
                                                    : item.score_percentage >= 50
                                                    ? 'bg-[var(--color-primary-10)] text-[var(--color-primary)] border-[var(--color-primary-20)]'
                                                    : 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error-20)]'
                                            }`}>
                                                {item.score_percentage}%
                                            </span>
                                        </td>
                                        <td className="py-3 font-medium">
                                            {item.correct_answers} / {item.total_questions}
                                        </td>
                                        <td className="py-3 text-[var(--color-muted)] font-mono">
                                            {Math.floor((item.time_spent_seconds || 0) / 60)}m {(item.time_spent_seconds || 0) % 60}s
                                        </td>
                                        <td className="py-3 text-[var(--color-muted)]">
                                            {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

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
                    onFinish={(result) => {
                        setActiveMode(null);
                        setExamResult(result);
                        fetchHistory();
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
