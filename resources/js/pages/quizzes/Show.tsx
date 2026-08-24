import { Head, router } from '@inertiajs/react';
import { useState, useEffect, FormEvent } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { getFreshQuiz, saveLocalAttempt } from '../../services/OfflineService';

interface Option {
    id: number;
    option_text: string;
}

interface Question {
    id: number;
    topic_id: number;
    question_text: string;
    type: string;
    difficulty?: string;
    explanation?: string;
    options: Option[];
}

interface Quiz {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
    questions: Question[];
}

interface Props {
    quizId: number;
}

type QuizMode = 'standard' | 'adaptive' | null;

interface AdaptiveState {
    state_id: number | string;
    attempt_id: string;
    ability_score: number;
    difficulty_label: string;
    questions_answered: number;
    total_questions: number;
    is_completed: boolean;
    answer_correct?: boolean;
    explanation?: string;
    correct_option_id?: number;
    score?: number;
    total_marks?: number;
    percentage?: number;
    ability_history?: number[];
    question: Question | null;
}

export default function Show({ quizId }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [mode, setMode] = useState<QuizMode>(null);
    const [_isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

    // Standard mode state
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [answers, setAnswers] = useState<Record<number, number>>({});

    // Adaptive mode state
    const [adaptiveState, setAdaptiveState] = useState<AdaptiveState | null>(null);
    const [adaptiveLoading, setAdaptiveLoading] = useState<boolean>(false);
    const [adaptiveCurrentQuestion, setAdaptiveCurrentQuestion] = useState<Question | null>(null);
    const [selectedAdaptiveOption, setSelectedAdaptiveOption] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState<boolean>(false);
    const [lastAnswerResult, setLastAnswerResult] = useState<{
        correct: boolean;
        explanation: string;
        correct_option_id: number;
    } | null>(null);

    // Shared state
    const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Online/offline detection
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Fetch quiz data (with offline cache)
    useEffect(() => {
        let isMounted = true;

        const loadQuiz = async () => {
            try {
                const freshQuiz = await getFreshQuiz(quizId);
                if (isMounted && freshQuiz) {
                    setQuiz(freshQuiz as Quiz);
                    if (freshQuiz.time_limit_minutes) {
                        setSecondsRemaining(freshQuiz.time_limit_minutes * 60);
                    }
                    setLoading(false);
                } else if (isMounted) {
                    setLoading(false);
                }
            } catch {
                if (isMounted) setLoading(false);
            }
        };

        loadQuiz();
        return () => { isMounted = false; };
    }, [quizId]);

    // Timer
    useEffect(() => {
        if (loading || !quiz || mode === null) return;

        const timer = setInterval(() => {
            setSecondsElapsed((prev) => prev + 1);
            if (secondsRemaining !== null) {
                setSecondsRemaining((prev) => {
                    if (prev === null) return null;
                    if (prev <= 1) {
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [loading, quiz, mode, secondsRemaining]);

    // ── Standard Mode Handlers ──

    const handleSelectOption = (questionId: number, optionId: number) => {
        setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    };

    const handleStandardSubmit = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        if (isSubmitting || !quiz) return;
        setIsSubmitting(true);

        const attemptId = crypto.randomUUID();
        const answerList = Object.entries(answers).map(([qId, oId]) => ({
            question_id: parseInt(qId),
            selected_option_id: oId,
            is_correct: false, // Will be determined server-side
            marks_awarded: 0,
        }));

        // Save locally for offline
        await saveLocalAttempt({
            id: attemptId,
            user_id: 'current',
            quiz_id: quiz.id,
            status: 'completed',
            score: null,
            total_marks: quiz.questions.length,
            started_at: new Date(Date.now() - secondsElapsed * 1000).toISOString(),
            completed_at: new Date().toISOString(),
            duration_seconds: secondsElapsed,
            answers: answerList.map(a => ({
                ...a,
                id: crypto.randomUUID(),
                quiz_attempt_id: attemptId,
                answered_at: new Date().toISOString(),
            })),
            synced: navigator.onLine,
        });

        if (navigator.onLine) {
            // Submit to server
            router.post(`/quizzes/${quiz.id}/attempt`, {
                answers: answers,
                duration_seconds: secondsElapsed,
            }, {
                onFinish: () => setIsSubmitting(false),
            });
        } else {
            // Offline — show saved message and redirect
            setIsSubmitting(false);
            router.visit('/dashboard');
        }
    };

    // ── Adaptive Mode Handlers ──

    const startAdaptiveQuiz = async () => {
        if (!quiz) return;
        setAdaptiveLoading(true);

        if (!navigator.onLine) {
            // Adaptive quiz requires server — show message
            alert('Adaptive quizzes require an internet connection. Please use Standard mode offline.');
            setAdaptiveLoading(false);
            return;
        }

        try {
            const res = await fetch(`/api/v1/quizzes/${quiz.id}/adaptive/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
            });
            if (!res.ok) throw new Error('Failed to start adaptive quiz');
            const data: AdaptiveState = await res.json();

            setAdaptiveState(data);
            setAdaptiveCurrentQuestion(data.question);
            setMode('adaptive');
        } catch (err) {
            console.error(err);
        } finally {
            setAdaptiveLoading(false);
        }
    };

    const submitAdaptiveAnswer = async () => {
        if (!quiz || !adaptiveState || !adaptiveCurrentQuestion) return;
        setIsSubmitting(true);

        try {
            const res = await fetch(`/api/v1/quizzes/${quiz.id}/adaptive/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
                body: JSON.stringify({
                    state_id: adaptiveState.state_id,
                    question_id: adaptiveCurrentQuestion.id,
                    selected_option_id: selectedAdaptiveOption,
                }),
            });
            if (!res.ok) throw new Error('Failed to submit answer');
            const data: AdaptiveState = await res.json();

            if (!data.is_completed && data.answer_correct !== undefined) {
                setLastAnswerResult({
                    correct: data.answer_correct,
                    explanation: data.explanation || '',
                    correct_option_id: data.correct_option_id || 0,
                });
                setShowFeedback(true);
            }

            setAdaptiveState(data);

            if (data.is_completed) {
                router.get(`/quizzes/attempts/${data.attempt_id}`);
                return;
            }

            if (!data.answer_correct === undefined) {
                setAdaptiveCurrentQuestion(data.question);
                setSelectedAdaptiveOption(null);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const continueAfterFeedback = () => {
        setShowFeedback(false);
        setLastAnswerResult(null);
        setAdaptiveCurrentQuestion(adaptiveState?.question ?? null);
        setSelectedAdaptiveOption(null);
    };

    // ── Helpers ──

    function getCsrfToken(): string {
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') || '' : '';
    }

    const formatTime = (totalSeconds: number) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const getDifficultyColor = (label: string) => {
        switch (label) {
            case 'Beginner':    return 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20';
            case 'Developing':  return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            case 'Proficient':  return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20';
            case 'Advanced':    return 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20';
            case 'Expert':      return 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20';
            default:            return 'text-[var(--color-muted)] bg-slate-500/10 border-slate-500/20';
        }
    };

    const getDifficultyBadge = (difficulty?: string) => {
        switch (difficulty) {
            case 'easy':   return 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20';
            case 'medium': return 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20';
            case 'hard':   return 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20';
            default:       return 'bg-slate-500/10 text-[var(--color-muted)] border-slate-500/20';
        }
    };

    const questions = quiz?.questions || [];
    const currentQuestion = questions[activeIndex];
    const progressPercent = questions.length > 0 ? ((activeIndex + 1) / questions.length) * 100 : 0;

    // ── Loading Skeleton ──
    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between p-4 md:p-8 animate-pulse">
                <Head title="Loading assessment..." />
                <header className="max-w-4xl w-full mx-auto flex justify-between items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-4 md:p-6 rounded-2xl">
                    <div className="space-y-2.5 w-1/3">
                        <div className="h-5 bg-[var(--color-background)]/80 rounded w-full" />
                        <div className="h-3 bg-[var(--color-background)]/80 rounded w-1/2" />
                    </div>
                    <div className="h-9 w-20 bg-[var(--color-background)]/80 rounded-xl" />
                </header>
                <main className="max-w-4xl w-full mx-auto my-6 md:my-10 flex-1 flex flex-col justify-center">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)]/85 p-6 md:p-10 rounded-3xl space-y-8 h-[340px] flex flex-col justify-between">
                        <div className="space-y-3">
                            <div className="h-4.5 bg-[var(--color-background)]/80 rounded w-16" />
                            <div className="h-6 bg-[var(--color-background)]/80 rounded w-5/6" />
                        </div>
                        <div className="space-y-3">
                            <div className="h-[54px] bg-[var(--color-background)]/80 rounded-2xl w-full" />
                            <div className="h-[54px] bg-[var(--color-background)]/80 rounded-2xl w-full" />
                        </div>
                    </div>
                </main>
                <footer className="max-w-4xl w-full mx-auto space-y-4">
                    <div className="w-full bg-[var(--color-surface)] h-2 rounded-full" />
                    <div className="flex justify-between items-center">
                        <div className="h-10 bg-[var(--color-surface)] rounded-xl w-24" />
                        <div className="h-10 bg-[var(--color-surface)] rounded-xl w-24" />
                    </div>
                </footer>
            </div>
        );
    }

    // ── Mode Selection Screen ──
    if (mode === null && quiz) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8">
                <Head title={quiz.title} />
                <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-center min-h-[80vh] space-y-10">
                    {/* Offline Banner */}
                    {!navigator.onLine && (
                        <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-xl px-4 py-3 flex items-center gap-3 max-w-2xl w-full">
                            <svg className="w-5 h-5 text-[var(--color-accent)] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                            </svg>
                            <span className="text-sm font-semibold text-[var(--color-accent)]">
                                You're offline. Standard quizzes are available — answers will sync when you reconnect.
                            </span>
                        </div>
                    )}

                    {/* Quiz Info Card */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-8 md:p-12 rounded-3xl backdrop-blur-md text-center space-y-6 max-w-2xl w-full">
                        <span className="text-[10px] font-extrabold px-3 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded-md tracking-wider uppercase">
                            Assessment
                        </span>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--color-text)] leading-tight">
                            {quiz.title}
                        </h1>
                        {quiz.description && (
                            <p className="text-[var(--color-muted)] text-sm md:text-base leading-relaxed max-w-xl mx-auto">
                                {quiz.description}
                            </p>
                        )}
                        <div className="flex items-center justify-center gap-6 text-sm text-[var(--color-muted)]">
                            <span className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {questions.length} Questions
                            </span>
                            {quiz.time_limit_minutes && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {quiz.time_limit_minutes} min
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Mode Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
                        {/* Standard Quiz */}
                        <button
                            onClick={() => setMode('standard')}
                            className="group bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl text-left transition-all hover:border-slate-700 hover:bg-[var(--color-surface)] hover:shadow-xl hover:shadow-[var(--color-accent)]/5 focus:outline-none cursor-pointer"
                        >
                            <div className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-border)] flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 group-hover:border-[var(--color-accent)]/30 transition-all">
                                    <svg className="w-6 h-6 text-[var(--color-muted)] group-hover:text-[var(--color-accent)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-bold text-[var(--color-text)] group-hover:text-white transition-colors">Standard Quiz</h3>
                                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                                    All questions presented in fixed order. Submit all answers at the end. Works offline!
                                </p>
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 rounded tracking-wider uppercase">
                                    Offline Ready
                                </span>
                            </div>
                        </button>

                        {/* Adaptive Quiz */}
                        <button
                            onClick={startAdaptiveQuiz}
                            disabled={adaptiveLoading || !navigator.onLine}
                            className="group bg-[var(--color-surface)] border border-[var(--color-accent)]/20 p-8 rounded-3xl text-left transition-all hover:border-indigo-500/40 hover:bg-indigo-950/20 hover:shadow-xl hover:shadow-indigo-500/10 focus:outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 flex items-center justify-center group-hover:bg-[var(--color-accent)]/20 group-hover:border-[var(--color-accent)]/30 transition-all">
                                    {adaptiveLoading ? (
                                        <svg className="w-6 h-6 text-[var(--color-accent)] animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    ) : (
                                        <svg className="w-6 h-6 text-[var(--color-accent)] group-hover:text-indigo-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-indigo-300 group-hover:text-indigo-200 transition-colors">
                                    Adaptive Quiz ✨
                                </h3>
                                <p className="text-sm text-[var(--color-muted)] leading-relaxed">
                                    AI-powered difficulty adjustment. Requires internet connection.
                                </p>
                                <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded tracking-wider uppercase">
                                    {navigator.onLine ? 'AI-Powered' : 'Requires Internet'}
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Adaptive Mode: Feedback Overlay ──
    if (showFeedback && lastAnswerResult) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8">
                <Head title="Answer Feedback" />
                <div className="max-w-4xl w-full mx-auto flex flex-col items-center justify-center min-h-[70vh] space-y-8">
                    <div className={`bg-[var(--color-surface)] border p-8 md:p-12 rounded-3xl backdrop-blur-md text-center space-y-6 max-w-2xl w-full ${
                        lastAnswerResult.correct
                            ? 'border-[var(--color-success)]/20'
                            : 'border-[var(--color-error)]/20'
                    }`}>
                        <div className={`h-16 w-16 rounded-full mx-auto flex items-center justify-center ${
                            lastAnswerResult.correct
                                ? 'bg-[var(--color-success)]/10 border border-[var(--color-success)]/20'
                                : 'bg-[var(--color-error)]/10 border border-[var(--color-error)]/20'
                        }`}>
                            {lastAnswerResult.correct ? (
                                <svg className="w-8 h-8 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-8 h-8 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                        </div>

                        <h2 className={`text-2xl font-extrabold ${lastAnswerResult.correct ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {lastAnswerResult.correct ? 'Correct!' : 'Not Quite!'}
                        </h2>

                        {adaptiveState && (
                            <div className="flex items-center justify-center gap-3">
                                <span className="text-sm text-[var(--color-muted)]">Ability:</span>
                                <span className={`text-lg font-bold ${getDifficultyColor(adaptiveState.difficulty_label).split(' ')[0]}`}>
                                    {adaptiveState.ability_score}
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${getDifficultyColor(adaptiveState.difficulty_label)}`}>
                                    {adaptiveState.difficulty_label}
                                </span>
                            </div>
                        )}

                        {lastAnswerResult.explanation && (
                            <div className="p-5 bg-indigo-950/20 border border-indigo-500/10 rounded-2xl text-left space-y-2">
                                <span className="block text-xs font-bold text-[var(--color-accent)] uppercase tracking-wider">
                                    Explanation
                                </span>
                                <div className="chat-markdown text-sm text-[var(--color-muted)] leading-relaxed">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{lastAnswerResult.explanation}</Markdown>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={continueAfterFeedback}
                        className="px-8 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-white text-sm font-extrabold shadow-lg shadow-indigo-600/10 transition-all focus:outline-none min-h-[48px]"
                    >
                        Next Question →
                    </button>
                </div>
            </div>
        );
    }

    // ── Adaptive Mode: Quiz In Progress ──
    if (mode === 'adaptive' && adaptiveState && adaptiveCurrentQuestion) {
        const adaptiveProgress = adaptiveState.total_questions > 0
            ? (adaptiveState.questions_answered / adaptiveState.total_questions) * 100
            : 0;

        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between p-4 md:p-8">
                <Head title={`${quiz?.title} — Adaptive`} />

                <header className="max-w-4xl w-full mx-auto flex justify-between items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-4 md:p-6 rounded-2xl backdrop-blur-md">
                    <div className="space-y-1">
                        <h1 className="text-lg md:text-xl font-extrabold text-[var(--color-text)] truncate max-w-[200px] sm:max-w-md">
                            {quiz?.title}
                        </h1>
                        <span className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider block">
                            Question {adaptiveState.questions_answered + 1} of {adaptiveState.total_questions}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${getDifficultyColor(adaptiveState.difficulty_label)}`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {adaptiveState.ability_score}
                        </div>

                        {secondsRemaining !== null && (
                            <div className={`px-4 py-2 rounded-xl border flex items-center space-x-2 text-sm font-bold ${
                                secondsRemaining < 60
                                    ? 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20 animate-pulse'
                                    : 'bg-[var(--color-background)]/60 text-[var(--color-accent)] border-[var(--color-border)]'
                            }`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{formatTime(secondsRemaining)}</span>
                            </div>
                        )}
                    </div>
                </header>

                <main className="max-w-4xl w-full mx-auto my-6 md:my-10 flex-1 flex flex-col justify-center">
                    <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)]/80 p-6 md:p-10 rounded-3xl shadow-xl flex flex-col justify-between space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded-md tracking-wider uppercase">
                                    {adaptiveCurrentQuestion.type.replace('_', ' ')}
                                </span>
                                {adaptiveCurrentQuestion.difficulty && (
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 border rounded-md tracking-wider uppercase ${getDifficultyBadge(adaptiveCurrentQuestion.difficulty)}`}>
                                        {adaptiveCurrentQuestion.difficulty}
                                    </span>
                                )}
                            </div>
                            <p className="text-lg md:text-xl font-bold leading-relaxed text-[var(--color-text)]">
                                {adaptiveCurrentQuestion.question_text}
                            </p>
                        </div>

                        <div className="space-y-3.5">
                            {adaptiveCurrentQuestion.options.map((option) => {
                                const isSelected = selectedAdaptiveOption === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => setSelectedAdaptiveOption(option.id)}
                                        className={`w-full text-left px-5 py-4 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-between min-h-[58px] focus:outline-none cursor-pointer ${
                                            isSelected
                                                ? 'bg-[var(--color-accent)]/10 text-indigo-200 border-indigo-500 shadow-md shadow-[var(--color-accent)]/5'
                                                : 'bg-[var(--color-background)]/40 hover:bg-[var(--color-primary-5)]/40 text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-border)]'
                                        }`}
                                    >
                                        <span>{option.option_text}</span>
                                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                            isSelected
                                                ? 'border-indigo-500 bg-[var(--color-accent)]'
                                                : 'border-slate-700 bg-[var(--color-background)]/80'
                                        }`}>
                                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                );
                            })}

                            <button
                                onClick={() => setSelectedAdaptiveOption(null)}
                                className="w-full text-center py-3 text-xs text-[var(--color-muted)] hover:text-[var(--color-muted)] transition-colors font-semibold"
                            >
                                Skip this question →
                            </button>
                        </div>
                    </div>
                </main>

                <footer className="max-w-4xl w-full mx-auto space-y-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap">
                            {adaptiveState.difficulty_label}
                        </span>
                        <div className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] h-2.5 rounded-full overflow-hidden relative">
                            <div
                                className={`h-full rounded-full transition-all duration-500 shadow-md ${
                                    adaptiveState.difficulty_label === 'Expert' ? 'bg-rose-500 shadow-rose-500/20' :
                                    adaptiveState.difficulty_label === 'Advanced' ? 'bg-amber-500 shadow-amber-500/20' :
                                    adaptiveState.difficulty_label === 'Proficient' ? 'bg-[var(--color-accent)] shadow-indigo-600/20' :
                                    adaptiveState.difficulty_label === 'Developing' ? 'bg-blue-500 shadow-blue-500/20' :
                                    'bg-emerald-500 shadow-emerald-500/20'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, ((adaptiveState.ability_score - 500) / 2000) * 100))}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider whitespace-nowrap">
                            {adaptiveState.questions_answered}/{adaptiveState.total_questions}
                        </span>
                    </div>

                    <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] h-2.5 rounded-full overflow-hidden">
                        <div
                            className="bg-[var(--color-accent)] h-full transition-all duration-300 rounded-full shadow-md shadow-indigo-600/20"
                            style={{ width: `${adaptiveProgress}%` }}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={submitAdaptiveAnswer}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-white text-sm font-extrabold shadow-lg shadow-indigo-600/10 transition-all focus:outline-none min-h-[48px] disabled:opacity-50"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                        </button>
                    </div>
                </footer>
            </div>
        );
    }

    // ── Standard Mode: Quiz In Progress ──
    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between p-4 md:p-8">
            <Head title={quiz?.title} />

            <header className="max-w-4xl w-full mx-auto flex justify-between items-center bg-[var(--color-surface)] border border-[var(--color-border)] p-4 md:p-6 rounded-2xl backdrop-blur-md">
                <div className="space-y-1">
                    <h1 className="text-lg md:text-xl font-extrabold text-[var(--color-text)] truncate max-w-[200px] sm:max-w-md">
                        {quiz?.title}
                    </h1>
                    <span className="text-xs text-[var(--color-muted)] font-semibold uppercase tracking-wider block">
                        Question {activeIndex + 1} of {questions.length}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {!navigator.onLine && (
                        <div className="px-3 py-1.5 rounded-xl border bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20 text-[var(--color-accent)] text-xs font-bold flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
                            </svg>
                            Offline
                        </div>
                    )}

                    {secondsRemaining !== null && (
                        <div className={`px-4 py-2 rounded-xl border flex items-center space-x-2 text-sm font-bold ${
                            secondsRemaining < 60
                                ? 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20 animate-pulse'
                                : 'bg-[var(--color-background)]/60 text-[var(--color-accent)] border-[var(--color-border)]'
                        }`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{formatTime(secondsRemaining)}</span>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-4xl w-full mx-auto my-6 md:my-10 flex-1 flex flex-col justify-center">
                {questions.length === 0 ? (
                    <div className="text-center py-16 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/20">
                        <p className="text-[var(--color-muted)]">This assessment currently contains no questions.</p>
                    </div>
                ) : (
                    <div className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)]/80 p-6 md:p-10 rounded-3xl shadow-xl flex flex-col justify-between space-y-8">
                        <div className="space-y-4">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 rounded-md tracking-wider uppercase">
                                {currentQuestion.type.replace('_', ' ')}
                            </span>
                            <p className="text-lg md:text-xl font-bold leading-relaxed text-[var(--color-text)]">
                                {currentQuestion.question_text}
                            </p>
                        </div>

                        <div className="space-y-3.5">
                            {currentQuestion.options.map((option) => {
                                const isSelected = answers[currentQuestion.id] === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        onClick={() => handleSelectOption(currentQuestion.id, option.id)}
                                        className={`w-full text-left px-5 py-4 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-between min-h-[58px] focus:outline-none cursor-pointer ${
                                            isSelected
                                                ? 'bg-[var(--color-accent)]/10 text-indigo-200 border-indigo-500 shadow-md shadow-[var(--color-accent)]/5'
                                                : 'bg-[var(--color-background)]/40 hover:bg-[var(--color-primary-5)]/40 text-[var(--color-muted)] border-[var(--color-border)] hover:border-[var(--color-border)]'
                                        }`}
                                    >
                                        <span>{option.option_text}</span>
                                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                                            isSelected
                                                ? 'border-indigo-500 bg-[var(--color-accent)]'
                                                : 'border-slate-700 bg-[var(--color-background)]/80'
                                        }`}>
                                            {isSelected && <div className="h-2 w-2 rounded-full bg-white" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            <footer className="max-w-4xl w-full mx-auto space-y-4">
                {questions.length > 0 && (
                    <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] h-2.5 rounded-full overflow-hidden">
                        <div
                            className="bg-[var(--color-accent)] h-full transition-all duration-300 rounded-full shadow-md shadow-indigo-600/20"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <button
                        onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeIndex === 0}
                        className="px-5 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:hover:bg-transparent text-sm font-bold transition-all focus:outline-none min-h-[48px]"
                    >
                        Previous
                    </button>

                    {activeIndex < questions.length - 1 ? (
                        <button
                            onClick={() => setActiveIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                            className="px-6 py-3 rounded-xl bg-[var(--color-primary-5)] hover:bg-slate-750 border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bold transition-all focus:outline-none min-h-[48px]"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            onClick={() => handleStandardSubmit()}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-white text-sm font-extrabold shadow-lg shadow-indigo-600/10 transition-all focus:outline-none min-h-[48px]"
                        >
                            {isSubmitting ? 'Submitting...' : 'Finish Assessment'}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
