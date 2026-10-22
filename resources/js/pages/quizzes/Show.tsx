import { Head, router } from '@inertiajs/react';
import { useState, useEffect, FormEvent } from 'react';
import { getFreshQuiz, saveLocalAttempt, cacheQuiz } from '@/services/OfflineService';
import { isCorrectOption } from '@/services/AnswerKey';
import { confirmAction } from '@/components/common/ConfirmModal';
import { getSyncUser } from '@/services/SyncQueue';
import { syncAll } from '@/services/SyncService';
import Result from './Result';
import { QuizHeader } from '@/components/quiz/QuizHeader';
import { QuestionCard, QuizQuestion } from '@/components/quiz/QuestionCard';
import { QuestionPalette } from '@/components/quiz/QuestionPalette';
import { QuizModeSelect } from '@/components/quiz/QuizModeSelect';
import { AdaptiveFeedbackModal } from '@/components/quiz/AdaptiveFeedbackModal';
import { PassagePanel } from '@/components/quiz/PassagePanel';
import type { QuizContext } from '@/components/quiz/PassageView';
import { passageRuns, pickAttemptQuestions } from '@/services/AttemptQuestions';

interface Quiz {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
    questions: QuizQuestion[];
    /** Shared passages; questions point to them with context_id. */
    contexts?: (QuizContext & { id: number })[];
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
    question: QuizQuestion | null;
}

export default function Show({ quizId }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [mode, setMode] = useState<QuizMode>(null);
    const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

    const effectiveQuizId =
        Number(quizId) ||
        (typeof window !== 'undefined'
            ? Number(window.location.pathname.split('/').filter(Boolean).pop())
            : 1);

    // Standard mode state
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [answers, setAnswers] = useState<Record<number, number>>({});
    const [activeQuestions, setActiveQuestions] = useState<QuizQuestion[]>([]);

    // Adaptive mode state
    const [adaptiveState, setAdaptiveState] = useState<AdaptiveState | null>(null);
    const [adaptiveLoading, setAdaptiveLoading] = useState<boolean>(false);
    const [adaptiveCurrentQuestion, setAdaptiveCurrentQuestion] = useState<QuizQuestion | null>(null);
    const [selectedAdaptiveOption, setSelectedAdaptiveOption] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState<boolean>(false);
    const [lastAnswerResult, setLastAnswerResult] = useState<{
        correct: boolean;
        explanation: string;
        correct_option_id: number;
    } | null>(null);

    // Shared timer & submission state
    const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
    const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [offlineAttemptId, setOfflineAttemptId] = useState<string | null>(null);

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
                const freshQuiz = await getFreshQuiz(effectiveQuizId);
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
        return () => {
            isMounted = false;
        };
    }, [effectiveQuizId]);

    // Timer countdown loop
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

    const startStandardQuiz = () => {
        if (!quiz) return;
        // 10 random questions, taking a passage's questions together and in order.
        const pool = quiz.questions || [];
        const selected = pool.length > 10 ? pickAttemptQuestions(pool) : pickAttemptQuestions(pool, pool.length, false);
        setActiveQuestions(selected);
        setActiveIndex(0);
        setAnswers({});
        setMode('standard');
    };

    const handleStandardSubmit = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        if (isSubmitting || !quiz) return;

        const shown = activeQuestions.length > 0 ? activeQuestions.length : pickAttemptQuestions(quiz.questions, 10, false).length;
        const unanswered = shown - Object.keys(answers).length;
        if (!(await confirmAction({
            title: 'Submit your answers?',
            message: unanswered > 0
                ? `You have ${unanswered} unanswered question${unanswered === 1 ? '' : 's'}; they will be marked wrong. You can't change your answers after submitting.`
                : "You can't change your answers after submitting.",
            confirmLabel: 'Submit',
            cancelLabel: 'Keep working',
            tone: unanswered > 0 ? 'warning' : 'primary',
        }))) return;
        setIsSubmitting(true);

        const attemptId = crypto.randomUUID();
        let calculatedScore = 0;
        let totalMarks = 0;
        const questionsToGrade = activeQuestions.length > 0 ? activeQuestions : pickAttemptQuestions(quiz.questions, 10, false);

        // Provisional offline score: every question shown is recorded (unanswered ones too)
        // and weighted by its marks, exactly as the server grades it. Only whether the chosen
        // option matches the answer hash is checked; the correct option itself is never
        // stored. The server re-grades the attempt when it syncs and its score replaces this one.
        const answerList = await Promise.all(
            questionsToGrade.map(async (question) => {
                const marks = question.marks ?? 1;
                const selected = answers[question.id] ?? null;

                const isCorrect = selected === null
                    ? false
                    : question.answer_hash
                        ? await isCorrectOption('q', question.id, selected, question.answer_hash)
                        : Boolean((question.options as any[])?.find((o) => o.id === selected)?.is_correct);

                totalMarks += marks;
                if (isCorrect) calculatedScore += marks;

                return {
                    question_id: question.id,
                    selected_option_id: selected,
                    is_correct: isCorrect,
                    marks_awarded: isCorrect ? marks : 0,
                };
            })
        );

        try {
            await cacheQuiz({
                id: quiz.id,
                title: quiz.title,
                description: quiz.description,
                time_limit_minutes: quiz.time_limit_minutes,
                status: 'active',
                questions: quiz.questions as any,
                contexts: quiz.contexts as any,
                cached_at: new Date().toISOString(),
            });

            const completedAt = new Date().toISOString();
            await saveLocalAttempt({
                id: attemptId,
                user_id: getSyncUser() ?? 'current',
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                status: 'completed',
                score: calculatedScore,
                total_marks: totalMarks,
                started_at: new Date(Date.now() - secondsElapsed * 1000).toISOString(),
                completed_at: completedAt,
                duration_seconds: secondsElapsed,
                answers: answerList.map((a) => ({
                    ...a,
                    id: crypto.randomUUID(),
                    quiz_attempt_id: attemptId,
                    answered_at: completedAt,
                })),
                synced: false,
            });

            // Saved locally first; the sync engine uploads it now if online, or later.
            // The attempt id is generated here, so a retry can never create a second copy.
            if (navigator.onLine) {
                void syncAll();
            }
        } catch (err) {
            console.error('Local attempt save error:', err);
        } finally {
            setIsSubmitting(false);
            window.history.pushState(null, '', `/quizzes/attempts/${attemptId}`);
            setOfflineAttemptId(attemptId);
        }
    };

    // ── Adaptive Mode Handlers ──
    const startAdaptiveQuiz = async () => {
        if (!quiz) return;
        setAdaptiveLoading(true);

        if (!navigator.onLine) {
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

            if (data.answer_correct === undefined) {
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

    function getCsrfToken(): string {
        const match = document.cookie.split('; ').find((row) => row.startsWith('XSRF-TOKEN='));
        if (match) return decodeURIComponent(match.split('=')[1]);
        const meta = document.querySelector('meta[name="csrf-token"]');
        return meta ? meta.getAttribute('content') || '' : '';
    }

    const questions = activeQuestions.length > 0 ? activeQuestions : pickAttemptQuestions(quiz?.questions ?? [], 10, false);
    const currentQuestion = questions[activeIndex];

    // The passage the current question is about, and where its questions start and end.
    const contextFor = (q?: QuizQuestion | null): (QuizContext & { id?: number }) | null => {
        if (!q) return null;
        if (q.context) return q.context;
        return q.context_id ? quiz?.contexts?.find((c) => c.id === q.context_id) ?? null : null;
    };
    const runs = passageRuns(questions);
    const currentRun = runs.find((r) => activeIndex >= r.start && activeIndex <= r.end);
    const currentContext = contextFor(currentQuestion);
    const runLabel = (r: { start: number; end: number }) => r.start === r.end ? `Question ${r.start + 1} refers to this` : `Questions ${r.start + 1}–${r.end + 1} refer to this`;
    const paletteGroups = runs.map((r) => ({ start: r.start, end: r.end, label: contextFor(questions[r.start])?.title || `Questions ${r.start + 1}–${r.end + 1}: passage` }));
    const progressPercent = questions.length > 0 ? ((activeIndex + 1) / questions.length) * 100 : 0;

    // ── Offline Completed Result View ──
    if (offlineAttemptId) {
        return <Result attemptId={offlineAttemptId} />;
    }

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

    // ── Missing Quiz Fallback Screen ──
    if (!loading && !quiz) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col items-center justify-center p-6 text-center">
                <Head title="Quiz Not Available Offline" />
                <div className="max-w-md w-full bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-2xl space-y-4">
                    <h2 className="text-xl font-bold">Quiz Not Cached Offline</h2>
                    <p className="text-sm text-[var(--color-muted)]">
                        This assessment has not been cached for offline use yet. Please connect to the internet to pre-cache this quiz.
                    </p>
                    <div className="flex gap-3 justify-center pt-2">
                        <button
                            onClick={() => window.location.reload()}
                            className="btn-primary text-xs"
                        >
                            Retry
                        </button>
                        <a href="/subjects" className="px-4 py-2 border border-[var(--color-border)] rounded-xl text-xs font-semibold hover:bg-[var(--color-surface)]">
                            Browse Subjects
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // ── Mode Selection Screen ──
    if (mode === null && quiz) {
        return (
            <QuizModeSelect
                quizTitle={quiz.title}
                description={quiz.description}
                questionCount={pickAttemptQuestions(quiz.questions, 10, false).length}
                timeLimitMinutes={quiz.time_limit_minutes}
                isOnline={!isOffline}
                adaptiveLoading={adaptiveLoading}
                onSelectStandard={startStandardQuiz}
                onSelectAdaptive={startAdaptiveQuiz}
            />
        );
    }

    // ── Adaptive Mode: Feedback Overlay ──
    if (showFeedback && lastAnswerResult) {
        return (
            <AdaptiveFeedbackModal
                isCorrect={lastAnswerResult.correct}
                explanation={lastAnswerResult.explanation}
                abilityScore={adaptiveState?.ability_score}
                difficultyLabel={adaptiveState?.difficulty_label}
                onContinue={continueAfterFeedback}
            />
        );
    }

    // ── Adaptive Mode: Quiz In Progress ──
    if (mode === 'adaptive' && adaptiveState && adaptiveCurrentQuestion) {
        const adaptiveProgress =
            adaptiveState.total_questions > 0
                ? (adaptiveState.questions_answered / adaptiveState.total_questions) * 100
                : 0;

        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between p-4 md:p-8">
                <Head>
                    <title>{`${quiz?.title || 'Quiz'} | Adaptive Mode | AceDrill`}</title>
                    <meta name="robots" content="noindex, nofollow" />
                </Head>

                <QuizHeader
                    title={quiz?.title || 'Quiz'}
                    currentQuestionNumber={adaptiveState.questions_answered + 1}
                    totalQuestions={adaptiveState.total_questions}
                    isOnline={!isOffline}
                    secondsRemaining={secondsRemaining}
                    adaptiveAbilityScore={adaptiveState.ability_score}
                    adaptiveDifficultyLabel={adaptiveState.difficulty_label}
                />

                <main className={`${adaptiveCurrentQuestion.context ? 'max-w-6xl grid lg:grid-cols-2 gap-6 items-start' : 'max-w-4xl flex flex-col justify-center'} w-full mx-auto my-6 md:my-10 flex-1`}>
                    {adaptiveCurrentQuestion.context && (
                        <PassagePanel key={adaptiveCurrentQuestion.context.id ?? 'ctx'} context={adaptiveCurrentQuestion.context} label="This question refers to it" />
                    )}
                    <QuestionCard
                        question={adaptiveCurrentQuestion}
                        selectedOptionId={selectedAdaptiveOption}
                        onSelectOption={setSelectedAdaptiveOption}
                        onSkip={() => setSelectedAdaptiveOption(null)}
                    />
                </main>

                <footer className="max-w-4xl w-full mx-auto space-y-4">
                    <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] h-2.5 rounded-full overflow-hidden">
                        <div
                            className="bg-[var(--color-accent)] h-full transition-all duration-300 rounded-full shadow-sm"
                            style={{ width: `${adaptiveProgress}%` }}
                        />
                    </div>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={submitAdaptiveAnswer}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-white text-sm font-extrabold shadow-sm transition-all focus:outline-none min-h-[48px] disabled:opacity-50 cursor-pointer"
                        >
                            {isSubmitting ? 'Submitting...' : 'Submit Answer'}
                        </button>
                    </div>
                </footer>
            </div>
        );
    }

    // ── Standard Mode: Quiz In Progress ──
    const answeredIndices = new Set(
        questions
            .map((q, idx) => (answers[q.id] !== undefined ? idx : -1))
            .filter((idx) => idx !== -1)
    );

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex flex-col justify-between p-4 md:p-8">
            <Head>
                <title>{`${quiz?.title || 'Quiz'} | AceDrill`}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <QuizHeader
                title={quiz?.title || 'Quiz'}
                currentQuestionNumber={activeIndex + 1}
                totalQuestions={questions.length}
                isOnline={!isOffline}
                secondsRemaining={secondsRemaining}
            />

            <main className={`${currentContext ? 'max-w-6xl' : 'max-w-4xl'} w-full mx-auto my-6 md:my-10 flex-1 flex flex-col justify-center space-y-4`}>
                {/* Question jumping palette */}
                <QuestionPalette
                    totalQuestions={questions.length}
                    currentIndex={activeIndex}
                    answeredIndices={answeredIndices}
                    onSelectIndex={setActiveIndex}
                    groups={paletteGroups}
                />

                {questions.length === 0 ? (
                    <div className="text-center py-16 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/20">
                        <p className="text-[var(--color-muted)]">This assessment currently contains no questions.</p>
                    </div>
                ) : (
                    currentQuestion && (
                        <div className={currentContext ? 'grid lg:grid-cols-2 gap-6 items-start' : ''}>
                            {currentContext && currentRun && (
                                <PassagePanel key={`${currentRun.start}-${currentContext.id ?? ''}`} context={currentContext} label={runLabel(currentRun)} />
                            )}
                            <QuestionCard
                                question={currentQuestion}
                                selectedOptionId={answers[currentQuestion.id] ?? null}
                                onSelectOption={(oId) => handleSelectOption(currentQuestion.id, oId)}
                                passageNote={currentContext && currentRun ? `Question ${activeIndex + 1} · ${currentContext.title || 'about the passage'}` : null}
                            />
                        </div>
                    )
                )}
            </main>

            <footer className="max-w-4xl w-full mx-auto space-y-4">
                {questions.length > 0 && (
                    <div className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] h-2.5 rounded-full overflow-hidden">
                        <div
                            className="bg-[var(--color-accent)] h-full transition-all duration-300 rounded-full shadow-sm"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <button
                        type="button"
                        onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
                        disabled={activeIndex === 0}
                        className="px-5 py-3 rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:hover:bg-transparent text-sm font-bold transition-all focus:outline-none min-h-[48px] cursor-pointer"
                    >
                        Previous
                    </button>

                    {activeIndex < questions.length - 1 ? (
                        <button
                            type="button"
                            onClick={() => setActiveIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                            className="px-6 py-3 rounded-xl bg-[var(--color-primary-5)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bold transition-all focus:outline-none min-h-[48px] cursor-pointer"
                        >
                            Next
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleStandardSubmit()}
                            disabled={isSubmitting}
                            className="px-6 py-3 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent)] text-white text-sm font-extrabold shadow-sm transition-all focus:outline-none min-h-[48px] cursor-pointer"
                        >
                            {isSubmitting ? 'Submitting...' : 'Finish Assessment'}
                        </button>
                    )}
                </div>
            </footer>
        </div>
    );
}
