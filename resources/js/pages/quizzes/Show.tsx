import { Head, router } from '@inertiajs/react';
import { useState, useEffect, FormEvent } from 'react';
import { getFreshQuiz, saveLocalAttempt, cacheQuiz, markAttemptSynced, verifyOptionHash, findCorrectOptionId } from '@/services/OfflineService';
import Result from './Result';
import { QuizHeader } from '@/components/quiz/QuizHeader';
import { QuestionCard, QuizQuestion } from '@/components/quiz/QuestionCard';
import { QuestionPalette } from '@/components/quiz/QuestionPalette';
import { QuizModeSelect } from '@/components/quiz/QuizModeSelect';
import { AdaptiveFeedbackModal } from '@/components/quiz/AdaptiveFeedbackModal';

interface Quiz {
    id: number;
    title: string;
    description: string | null;
    time_limit_minutes: number | null;
    questions: QuizQuestion[];
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
        const pool = [...(quiz.questions || [])];
        const selected = pool.length > 10
            ? pool.sort(() => Math.random() - 0.5).slice(0, 10)
            : pool;
        setActiveQuestions(selected);
        setActiveIndex(0);
        setAnswers({});
        setMode('standard');
    };

    const handleStandardSubmit = async (e?: FormEvent) => {
        if (e) e.preventDefault();
        if (isSubmitting || !quiz) return;
        setIsSubmitting(true);

        const attemptId = crypto.randomUUID();
        let calculatedScore = 0;
        const questionsToGrade = activeQuestions.length > 0 ? activeQuestions : quiz.questions.slice(0, 10);

        const answerList = await Promise.all(
            questionsToGrade.map(async (question) => {
                const questionId = question.id;
                const oId = answers[questionId] ?? null;

                let isCorrect = false;
                let correctOptId: number | null = null;

                if (question.answer_hash && question.options) {
                    if (oId) {
                        isCorrect = await verifyOptionHash(questionId, oId, question.answer_hash);
                    }
                    correctOptId = await findCorrectOptionId(questionId, question.options, question.answer_hash);
                } else {
                    const correctOption = (question.options as any[])?.find((o) => o.is_correct);
                    correctOptId = correctOption ? correctOption.id : null;
                    isCorrect = correctOption && oId ? correctOption.id === oId : false;
                }

                if (isCorrect) calculatedScore++;

                return {
                    question_id: questionId,
                    selected_option_id: oId,
                    is_correct: isCorrect,
                    marks_awarded: isCorrect ? 1 : 0,
                    correct_option_id: correctOptId,
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
                cached_at: new Date().toISOString(),
            });

            await saveLocalAttempt({
                id: attemptId,
                user_id: 'current',
                quiz_id: quiz.id,
                quiz_title: quiz.title,
                status: 'completed',
                score: calculatedScore,
                total_marks: questionsToGrade.length,
                started_at: new Date(Date.now() - secondsElapsed * 1000).toISOString(),
                completed_at: new Date().toISOString(),
                duration_seconds: secondsElapsed,
                answers: answerList.map((a) => ({
                    ...a,
                    id: crypto.randomUUID(),
                    quiz_attempt_id: attemptId,
                    answered_at: new Date().toISOString(),
                })),
                synced: false,
            });

            if (navigator.onLine) {
                try {
                    const res = await fetch(`/api/v1/quizzes/attempts/${attemptId}/sync`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': getCsrfToken(),
                        },
                        body: JSON.stringify({
                            quiz_id: quiz.id,
                            answers: answerList,
                            duration_seconds: secondsElapsed,
                        }),
                    });

                    if (res.ok) {
                        await markAttemptSynced(attemptId);
                    }
                } catch {
                    // Stored locally for background auto-sync
                }
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

    const questions = activeQuestions.length > 0 ? activeQuestions : (quiz?.questions?.slice(0, 10) || []);
    const currentQuestion = questions[activeIndex];
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
                questionCount={Math.min(quiz.questions.length, 10)}
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

                <main className="max-w-4xl w-full mx-auto my-6 md:my-10 flex-1 flex flex-col justify-center">
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

            <main className="max-w-4xl w-full mx-auto my-6 md:my-10 flex-1 flex flex-col justify-center space-y-4">
                {/* Question jumping palette */}
                <QuestionPalette
                    totalQuestions={questions.length}
                    currentIndex={activeIndex}
                    answeredIndices={answeredIndices}
                    onSelectIndex={setActiveIndex}
                />

                {questions.length === 0 ? (
                    <div className="text-center py-16 border border-[var(--color-border)] rounded-2xl bg-[var(--color-surface)]/20">
                        <p className="text-[var(--color-muted)]">This assessment currently contains no questions.</p>
                    </div>
                ) : (
                    currentQuestion && (
                        <QuestionCard
                            question={currentQuestion}
                            selectedOptionId={answers[currentQuestion.id] ?? null}
                            onSelectOption={(oId) => handleSelectOption(currentQuestion.id, oId)}
                        />
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
