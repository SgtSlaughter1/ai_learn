import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PastQuestionItem, ExamSimulationResult } from '../../types/past-questions';
import { formatMathText, extractLiteratureContext } from '../../utils/mathFormatter';
import { BookOpen, Monitor, Keyboard } from 'lucide-react';
import { enqueue, getSyncUser } from '@/services/SyncQueue';

interface Props {
    questions: PastQuestionItem[];
    examCode: string;
    examTitle: string;
    subjectTitle: string;
    yearTitle?: string;
    durationMinutes: number;
    simulationId?: number;
    simulationClientId?: string;
    onFinish: (result: ExamSimulationResult) => void;
    onCancel: () => void;
}

export const ExamSimulationModal: React.FC<Props> = ({
    questions,
    examCode,
    examTitle,
    subjectTitle,
    yearTitle,
    durationMinutes,
    simulationId,
    simulationClientId,
    onFinish,
    onCancel,
}) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [flagged, setFlagged] = useState<Record<number, boolean>>({});
    const [secondsRemaining, setSecondsRemaining] = useState<number>(durationMinutes * 60);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
    const [showCalculator, setShowCalculator] = useState<boolean>(false);
    const [calcDisplay, setCalcDisplay] = useState<string>('0');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Official JAMB Center View Toggle (High-contrast authentic test center layout)
    const [isJambView, setIsJambView] = useState<boolean>(() => {
        try {
            return localStorage.getItem('acedrill_cbt_jamb_view') === 'true';
        } catch {
            return false;
        }
    });

    const toggleJambView = () => {
        setIsJambView(prev => {
            const next = !prev;
            try {
                localStorage.setItem('acedrill_cbt_jamb_view', String(next));
            } catch {}
            return next;
        });
    };

    const totalSeconds = durationMinutes * 60;
    const timeSpentSeconds = totalSeconds - secondsRemaining;

    useEffect(() => {
        if (secondsRemaining <= 0) {
            handleFinalSubmit();
            return;
        }

        const timer = setInterval(() => {
            setSecondsRemaining(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsRemaining]);

    const currentQ = questions[currentIndex];

    // Authentic CBT Test Center Keyboard Navigation (A, B, C, D, N, P, R, S, Esc)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const key = e.key.toUpperCase();

            if (key === 'A' || key === '1') {
                e.preventDefault();
                if (currentQ?.options[0]) handleSelectOption(currentQ.options[0].id);
            } else if (key === 'B' || key === '2') {
                e.preventDefault();
                if (currentQ?.options[1]) handleSelectOption(currentQ.options[1].id);
            } else if (key === 'C' && !e.ctrlKey && !e.metaKey) {
                if (currentQ?.options[2]) {
                    e.preventDefault();
                    handleSelectOption(currentQ.options[2].id);
                }
            } else if (key === 'D' || key === '4') {
                e.preventDefault();
                if (currentQ?.options[3]) handleSelectOption(currentQ.options[3].id);
            } else if (key === 'E' || key === '5') {
                e.preventDefault();
                if (currentQ?.options[4]) handleSelectOption(currentQ.options[4].id);
            } else if (key === 'N' || key === 'ARROWRIGHT') {
                e.preventDefault();
                setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
            } else if (key === 'P' || key === 'ARROWLEFT') {
                e.preventDefault();
                setCurrentIndex(prev => Math.max(0, prev - 1));
            } else if (key === 'R') {
                e.preventDefault();
                toggleFlag();
            } else if (key === 'S' && (e.ctrlKey || e.metaKey || isJambView)) {
                e.preventDefault();
                setShowSubmitConfirm(true);
            } else if (key === 'ESCAPE') {
                e.preventDefault();
                if (showSubmitConfirm) setShowSubmitConfirm(false);
                else if (showCalculator) setShowCalculator(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, currentQ, questions.length, showSubmitConfirm, showCalculator, isJambView]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const answeredCount = Object.keys(selectedAnswers).length;
    const flaggedCount = Object.values(flagged).filter(Boolean).length;
    const unansweredCount = questions.length - answeredCount;

    const handleSelectOption = (optId: number) => {
        setSelectedAnswers(prev => ({
            ...prev,
            [currentQ.id]: optId,
        }));
    };

    const toggleFlag = () => {
        setFlagged(prev => ({
            ...prev,
            [currentQ.id]: !prev[currentQ.id],
        }));
    };

    const handleFinalSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setErrorMessage(null);

        const submitPayload = {
            simulation_id: simulationId,
            client_id: simulationClientId,
            mode: 'simulation',
            duration_seconds: durationMinutes * 60,
            completed_at: new Date().toISOString(),
            exam_code: examCode,
            exam_year: currentQ?.exam_year,
            time_spent_seconds: timeSpentSeconds,
            answers: selectedAnswers,
            question_ids: questions.map(q => q.id),
        };

        // Same key for the online try and any queued retry, so the result is counted once.
        const idempotencyKey = crypto.randomUUID();
        let attemptedOnline = false;

        if (navigator.onLine) {
            try {
                attemptedOnline = true;
                const res = await fetch('/api/v1/past-questions/simulation/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'Idempotency-Key': idempotencyKey,
                    },
                    body: JSON.stringify(submitPayload),
                });

                const data = await res.json().catch(() => null);
                if (res.ok && data?.success) {
                    onFinish(data.data);
                    return;
                }
            } catch (err) {
                console.warn('Online submit failed, falling back to local grading and queue:', err);
            }
        }

        // ── 100% Offline-First Fallback: Local grading and queue ──
        try {
            let correctCount = 0;
            const detailed = questions.map((q) => {
                const selectedId = selectedAnswers[q.id] ?? null;
                // Only grade when the correct option is known locally; guessing the first
                // option would show a wrong score until the server's result arrives.
                const correctOpt = q.options.find(o => o.is_correct);
                const isCorrect = selectedId !== null && selectedId === correctOpt?.id;
                if (isCorrect) correctCount++;
                const selectedOpt = q.options.find(o => o.id === selectedId);
                return {
                    question_id: q.id,
                    question_number: q.question_number,
                    question_text: q.question_text,
                    passage_text: q.passage_text,
                    image_url: q.image_url,
                    explanation: q.explanation,
                    topic: q.topic || { id: 1, name: 'Core Assessment' },
                    subject: q.subject || { id: 1, name: subjectTitle, slug: 'subject' },
                    selected_option_id: selectedId,
                    selected_option_text: selectedOpt?.option_text,
                    correct_option_id: correctOpt?.id ?? 0, // 0 = not known offline
                    correct_option_text: correctOpt?.option_text,
                    is_correct: isCorrect,
                    options: q.options,
                };
            });

            const totalQ = questions.length;
            const scorePct = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
            // Past-question answer keys are kept on the server, so offline the score can't be
            // worked out on the device: say so instead of showing a misleading 0%.
            const scoringPending = questions.some((q) => !q.options.some((o) => o.is_correct));

            // Queue for background sync when back online (guests' results aren't stored).
            if (getSyncUser()) await enqueue({
                table_name: 'pastQuestionSimulations',
                action: 'insert',
                record_id: `sim_${simulationClientId || crypto.randomUUID()}`,
                endpoint: '/api/v1/past-questions/simulation/submit',
                method: 'POST',
                payload: submitPayload,
                idempotency_key: idempotencyKey,
                sent: attemptedOnline,
            });

            onFinish({
                exam_code: examCode,
                exam_year: currentQ?.exam_year,
                total_questions: totalQ,
                correct_answers: correctCount,
                wrong_answers: totalQ - correctCount,
                score_percentage: scorePct,
                time_spent_seconds: timeSpentSeconds,
                topic_breakdown: [],
                weak_topics: [],
                detailed_results: detailed,
                scoring_pending: scoringPending,
                answered_count: Object.keys(selectedAnswers).length,
            });
        } catch (localErr) {
            console.error('Offline grade error:', localErr);
            setErrorMessage('Failed to grade exam attempt locally.');
            setIsSubmitting(false);
        }
    };

    const handleCalcInput = (char: string) => {
        if (char === 'C') {
            setCalcDisplay('0');
        } else if (char === '=') {
            try {
                const sanitized = calcDisplay.replace(/[^0-9+\-*/.]/g, '');
                // eslint-disable-next-line no-eval
                const result = Function(`'use strict'; return (${sanitized})`)();
                setCalcDisplay(String(result));
            } catch {
                setCalcDisplay('Error');
            }
        } else {
            setCalcDisplay(prev => (prev === '0' || prev === 'Error' ? char : prev + char));
        }
    };

    const isTimerCritical = secondsRemaining < 300;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)] text-[var(--color-text)] select-none overflow-hidden">
            {/* In-app Toast Error Banner */}
            {errorMessage && (
                <div className="fixed top-20 right-6 z-50 max-w-md bg-[var(--color-error)] text-white px-4 py-3 rounded-2xl shadow-2xl flex items-start gap-3 animate-fade-in border border-white/20">
                    <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1 text-xs font-semibold leading-relaxed">
                        {errorMessage}
                    </div>
                    <button
                        onClick={() => setErrorMessage(null)}
                        className="text-white/80 hover:text-white cursor-pointer ml-1 text-sm font-bold"
                    >
                        ✕
                    </button>
                </div>
            )}
            {/* Top Exam Header */}
            <header className="min-h-14 sm:h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-3 sm:px-6 md:px-8 flex items-center justify-between gap-1.5 sm:gap-4 shadow-xs shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary)] text-white shadow-xs shrink-0 max-w-[120px] sm:max-w-none truncate">
                        {examTitle}
                    </span>
                    <div className="hidden sm:block truncate">
                        <span className="font-bold text-sm text-[var(--color-text)]">{subjectTitle}</span>
                        {yearTitle && <span className="text-xs text-[var(--color-muted)] ml-2">({yearTitle})</span>}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 shrink-0">
                    {/* Timer */}
                    <div className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl border font-mono font-bold text-xs sm:text-sm md:text-base transition-colors shrink-0 ${
                        isTimerCritical
                            ? 'bg-[var(--color-error-10)] border-[var(--color-error)] text-[var(--color-error)] animate-pulse'
                            : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text)]'
                    }`}>
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-inherit shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTime(secondsRemaining)}</span>
                    </div>

                    {/* Calculator Toggle */}
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className={`p-1.5 sm:p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 ${
                            showCalculator
                                ? 'bg-[var(--color-primary)] text-white border-transparent'
                                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)]'
                        }`}
                        title="Toggle CBT Calculator"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden md:inline">Calculator</span>
                    </button>

                    {/* Official JAMB Center View Toggle */}
                    <button
                        onClick={toggleJambView}
                        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                            isJambView
                                ? 'bg-[#0f2e1e] text-emerald-300 border-emerald-500 shadow-sm ring-1 ring-emerald-500/30'
                                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)]'
                        }`}
                        title="Toggle Official JAMB Test Center High-Contrast Mode"
                    >
                        <Monitor className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden lg:inline">{isJambView ? 'Official JAMB Center: ON' : 'JAMB Center View'}</span>
                        <span className="lg:hidden">JAMB View</span>
                    </button>

                    {/* Submit Button */}
                    <button
                        onClick={() => setShowSubmitConfirm(true)}
                        className="px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[var(--color-success)] hover:opacity-90 text-white font-bold text-xs sm:text-sm transition-opacity shadow-sm cursor-pointer shrink-0 whitespace-nowrap"
                    >
                        Submit Test
                    </button>

                    {/* Exit Button */}
                    <button
                        onClick={onCancel}
                        className="p-1.5 sm:p-2 text-[var(--color-muted)] hover:text-[var(--color-error)] rounded-xl hover:bg-[var(--color-error-10)] transition-colors cursor-pointer shrink-0"
                        title="Exit Exam"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Authentic JAMB Institutional Banner when JAMB Center View is active */}
            {isJambView && (
                <div className="bg-[#0b1b13] border-b border-emerald-800/40 text-emerald-200 px-3 sm:px-8 py-1.5 text-[10px] sm:text-xs font-mono font-bold flex flex-wrap items-center justify-between shrink-0 shadow-inner">
                    <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-black">FEDERAL REPUBLIC OF NIGERIA</span>
                        <span className="text-emerald-600">•</span>
                        <span className="text-slate-200">JOINT ADMISSIONS AND MATRICULATION BOARD (JAMB CBT)</span>
                    </div>
                    <div className="flex items-center gap-3 text-emerald-300/90 text-[10px]">
                        <span>CANDIDATE: ACE-2026-ONLINE</span>
                        <span>REG: 20268849CA</span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 font-black">TERMINAL #14</span>
                    </div>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
                    <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-between space-y-6">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 gap-2 flex-wrap sm:flex-nowrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-base sm:text-lg text-[var(--color-primary)]">
                                    Question {currentIndex + 1}
                                </span>
                                <span className="text-xs text-[var(--color-muted)] font-medium">
                                    of {questions.length}
                                </span>
                                {currentQ.exam_year && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                        {currentQ.exam_code ? currentQ.exam_code.toUpperCase() : ''} {currentQ.exam_year}
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={toggleFlag}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                                    flagged[currentQ.id]
                                        ? 'bg-[var(--color-accent-20)] border-[var(--color-accent)] text-[var(--color-accent)] font-bold'
                                        : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                            >
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill={flagged[currentQ.id] ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                                {flagged[currentQ.id] ? 'Flagged for Review' : 'Flag for Review'}
                            </button>
                        </div>

                        {currentQ.passage_text && (
                            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm leading-relaxed text-[var(--color-text)] italic chat-markdown">
                                <span className="not-italic text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider block mb-1">
                                    Read Passage:
                                </span>
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {formatMathText(currentQ.passage_text)}
                                </Markdown>
                            </div>
                        )}

                        {/* Prescribed Literature / Novel Context Banner */}
                        {!currentQ.passage_text && extractLiteratureContext(currentQ.explanation) && (
                            <div className="p-3.5 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] flex items-center gap-3 text-xs shadow-xs">
                                <span className="p-1.5 rounded-xl bg-[var(--color-primary)] text-[var(--color-accent)] shrink-0">
                                    <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
                                </span>
                                <div className="space-y-0.5">
                                    <span className="font-extrabold uppercase text-[9px] tracking-wider text-[var(--color-primary)] block">
                                        Prescribed Literature Text
                                    </span>
                                    <span className="text-xs font-bold text-[var(--color-text)]">
                                        Based on: <strong className="text-[var(--color-primary)]">{extractLiteratureContext(currentQ.explanation)}</strong>
                                    </span>
                                </div>
                            </div>
                        )}

                        {currentQ.image_url && (
                            <div className="flex justify-center">
                                <img
                                    src={currentQ.image_url}
                                    alt="CBT Diagram"
                                    className="max-h-56 rounded-2xl border border-[var(--color-border)] shadow-xs object-contain"
                                />
                            </div>
                        )}

                        <div className="text-lg md:text-xl font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {formatMathText(currentQ.question_text)}
                            </Markdown>
                        </div>

                        <div className="space-y-3 pt-2 flex-1">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = selectedAnswers[currentQ.id] === option.id;
                                const label = option.label || chrFromIdx(idx);

                                return (
                                    <button
                                        key={option.id || idx}
                                        onClick={() => handleSelectOption(option.id)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                                            isSelected
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary-5)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary-20)] shadow-xs font-semibold'
                                                : 'border-[var(--color-border)] bg-[var(--color-background)]/40 hover:bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                                        }`}
                                    >
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 transition-colors ${
                                            isSelected
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]'
                                        }`}>
                                            {label}
                                        </span>
                                        <div className="flex-1 font-semibold text-sm [&_p]:inline">
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {formatMathText(option.option_text)}
                                            </Markdown>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
                            <button
                                disabled={currentIndex === 0}
                                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                className="px-6 py-2.5 rounded-xl border border-[var(--color-border)] font-bold text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1.5"
                            >
                                <span>← Previous</span>
                                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-muted)]">P</kbd>
                            </button>

                            <button
                                disabled={currentIndex === questions.length - 1}
                                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                className="px-8 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                            >
                                <span>Next →</span>
                                <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-black/20 border border-white/30 text-[10px] font-mono text-white/90">N</kbd>
                            </button>
                        </div>

                        {/* Real CBT Keyboard Shortcut Ribbon */}
                        <div className="p-3 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between gap-2 flex-wrap text-[11px] text-[var(--color-muted)] font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <Keyboard className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                                <span className="font-bold text-[var(--color-text)]">CBT Hotkeys:</span>
                                <div className="inline-flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">A</kbd>
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">B</kbd>
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">C</kbd>
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">D</kbd>
                                    <span>Select Option</span>
                                </div>
                                <span className="text-[var(--color-muted)]">•</span>
                                <div className="inline-flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">N</kbd>
                                    <span>Next</span>
                                </div>
                                <span className="text-[var(--color-muted)]">•</span>
                                <div className="inline-flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">P</kbd>
                                    <span>Prev</span>
                                </div>
                                <span className="text-[var(--color-muted)]">•</span>
                                <div className="inline-flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-surface-hover)] border border-[var(--color-border)] font-mono text-[10px] font-bold">R</kbd>
                                    <span>Flag</span>
                                </div>
                            </div>
                            <span className="text-[10px] text-[var(--color-muted)] hidden md:inline">
                                Realistic JAMB Test-Center controls
                            </span>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar / Bottom Palette on Mobile */}
                <aside className="w-full md:w-80 bg-[var(--color-surface)] border-t md:border-t-0 md:border-l border-[var(--color-border)] p-4 sm:p-5 flex flex-col shrink-0">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-muted)] mb-2.5">
                        Question Status Palette
                    </h3>

                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                        <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--color-success-10)] border border-[var(--color-success-20)]">
                            <span className="block text-sm sm:text-base font-black text-[var(--color-success)] leading-tight">{answeredCount}</span>
                            <span className="text-[9px] font-extrabold uppercase text-[var(--color-success)] tracking-wider">Answered</span>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--color-accent-10)] border border-[var(--color-accent-20)]">
                            <span className="block text-sm sm:text-base font-black text-[var(--color-accent)] leading-tight">{flaggedCount}</span>
                            <span className="text-[9px] font-extrabold uppercase text-[var(--color-accent)] tracking-wider">Flagged</span>
                        </div>
                        <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                            <span className="block text-sm sm:text-base font-black text-[var(--color-muted)] leading-tight">{unansweredCount}</span>
                            <span className="text-[9px] font-extrabold uppercase text-[var(--color-muted)] tracking-wider">Left</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto grid grid-cols-5 sm:grid-cols-8 md:grid-cols-5 gap-1.5 sm:gap-2 content-start p-1 max-h-56 md:max-h-none">
                        {questions.map((q, idx) => {
                            const isCurrent = currentIndex === idx;
                            const isAns = selectedAnswers[q.id] !== undefined;
                            const isFlg = Boolean(flagged[q.id]);

                            let tileStyle = 'bg-[var(--color-background)]/60 border-[var(--color-border)] text-[var(--color-muted)]';

                            if (isAns) tileStyle = 'bg-[var(--color-success)] text-white border-transparent font-bold';
                            if (isFlg) tileStyle = 'bg-[var(--color-accent)] text-white border-transparent font-bold';
                            if (isCurrent) tileStyle += ' ring-2 ring-[var(--color-primary)] ring-offset-2';

                            return (
                                <button
                                    key={q.id || idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`h-8 sm:h-9 rounded-xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${tileStyle}`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Calculator Popup */}
                {showCalculator && (
                    <div className="absolute top-4 right-4 md:right-84 z-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 shadow-2xl w-64 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border)]">
                            <span className="text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider">CBT Calculator</span>
                            <button
                                onClick={() => setShowCalculator(false)}
                                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-2.5 text-right font-mono text-xl font-bold truncate mb-3 text-[var(--color-text)]">
                            {calcDisplay}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].map((btn) => (
                                <button
                                    key={btn}
                                    onClick={() => handleCalcInput(btn)}
                                    className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        btn === 'C'
                                            ? 'col-span-4 bg-[var(--color-error)] text-white mt-1 hover:opacity-90'
                                            : btn === '='
                                            ? 'bg-[var(--color-success)] text-white hover:opacity-90'
                                            : 'bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/60 text-[var(--color-text)]'
                                    }`}
                                >
                                    {btn}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Submit Confirmation Dialog */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-md p-3 sm:p-4 animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-4 sm:space-y-5 max-h-[92vh] overflow-y-auto">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)] flex items-center justify-center mx-auto">
                            <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-[var(--color-text)]">Submit Examination?</h3>
                            <p className="text-xs text-[var(--color-muted)] mt-1">
                                Are you sure you want to end this test simulation?
                            </p>
                        </div>

                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-4 text-xs space-y-2 text-left">
                            <div className="flex justify-between">
                                <span className="text-[var(--color-muted)] font-medium">Total Questions:</span>
                                <strong className="text-[var(--color-text)]">{questions.length}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-success)] font-bold">Answered:</span>
                                <strong className="text-[var(--color-success)]">{answeredCount}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-accent)] font-bold">Flagged for Review:</span>
                                <strong className="text-[var(--color-accent)]">{flaggedCount}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-error)] font-bold">Unanswered:</span>
                                <strong className="text-[var(--color-error)]">{unansweredCount}</strong>
                            </div>
                        </div>

                        <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="w-full sm:flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer text-center"
                            >
                                Return to Exam
                            </button>
                            <button
                                disabled={isSubmitting}
                                onClick={handleFinalSubmit}
                                className="w-full sm:flex-1 py-2.5 rounded-xl bg-[var(--color-success)] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm text-center"
                            >
                                {isSubmitting ? 'Grading...' : 'Yes, Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function chrFromIdx(index: number): string {
    return String.fromCharCode(65 + index);
}
