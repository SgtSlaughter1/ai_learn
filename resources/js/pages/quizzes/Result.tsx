import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/db/database';
import { SYNC_COMPLETED_EVENT } from '@/services/SyncService';
import { reviewAnswer } from '@/services/AnswerKey';
import { ResultSummaryCard } from '@/components/quiz/ResultSummaryCard';
import { ResultQuestionBreakdown, ResultAnswer } from '@/components/quiz/ResultQuestionBreakdown';
import { AiExplanationDrawer } from '@/components/quiz/AiExplanationDrawer';

interface Attempt {
    id: string;
    quiz_title: string;
    score: number;
    total_marks: number;
    completed_at: string | null;
    answers: ResultAnswer[];
    /** Score worked out on this device, not yet verified by the server. */
    provisional?: boolean;
    /** Local view: correct answers and explanations are not on this device. */
    answersHidden?: boolean;
}

interface Props {
    attemptId: string;
}

export default function Result({ attemptId }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [attempt, setAttempt] = useState<Attempt | null>(null);

    const effectiveAttemptId =
        attemptId ||
        (typeof window !== 'undefined'
            ? window.location.pathname.split('/').filter(Boolean).pop() || ''
            : '');

    // AI Explainer Sidebar States & Cache
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [explainQuestionText, setExplainQuestionText] = useState<string>('');
    const [explainContent, setExplainContent] = useState<string>('');
    const [explainLoading, setExplainLoading] = useState<boolean>(false);
    const [explainSelectedText, setExplainSelectedText] = useState<string | null>(null);
    const [explainCorrectText, setExplainCorrectText] = useState<string | null>(null);
    const [explainQuestionId, setExplainQuestionId] = useState<number | null>(null);
    const [explainTopicId, setExplainTopicId] = useState<number | null>(null);
    const explanationCacheRef = useRef<Record<string, string>>({});

    useEffect(() => {
        let isMounted = true;

        async function loadAttempt() {
            // 1. The attempt saved on this device, reviewed offline: right/wrong, the correct
            //    option and its explanation are worked out from the answer hashes (nothing
            //    readable is stored). The score stays provisional until the server verifies it.
            const localAttempt = await db.quizAttempts.get(effectiveAttemptId).catch(() => undefined);
            if (localAttempt && isMounted) {
                const localQuiz = await db.quizzes.get(localAttempt.quiz_id).catch(() => undefined);
                const questions = localQuiz?.questions || [];
                let reviewable = true;

                const answers: ResultAnswer[] = await Promise.all((localAttempt.answers || []).map(async (ans) => {
                    const question = questions.find((q) => q.id === ans.question_id);
                    const review = question?.answer_hash
                        ? await reviewAnswer('q', question, ans.selected_option_id)
                        : null;
                    if (!review?.correctOptionId) reviewable = false;

                    return {
                        id: ans.id,
                        question_id: ans.question_id,
                        question_text: question?.question_text || `Question #${ans.question_id}`,
                        context: question?.context_id ? localQuiz?.contexts?.find((c) => c.id === question.context_id) ?? null : null,
                        explanation: review?.explanation ?? '',
                        selected_option_id: ans.selected_option_id,
                        is_correct: review ? review.isCorrect : Boolean(ans.is_correct),
                        marks_awarded: ans.marks_awarded ?? 0,
                        options: (question?.options || []).map((o) => ({
                            id: o.id,
                            option_text: o.option_text,
                            is_correct: review ? o.id === review.correctOptionId : false,
                        })),
                    };
                }));

                if (isMounted) {
                    setAttempt({
                        id: localAttempt.id,
                        quiz_title: localAttempt.quiz_title || localQuiz?.title || `Quiz Assessment #${localAttempt.quiz_id}`,
                        score: localAttempt.score ?? 0,
                        total_marks: localAttempt.total_marks ?? answers.length,
                        completed_at: localAttempt.completed_at,
                        answers,
                        provisional: !localAttempt.verified,
                        // Only when this quiz has no answer hashes on the device (e.g. not downloaded).
                        answersHidden: !reviewable,
                    });
                    setLoading(false);
                }
            }

            // 2. The verified result from the server (once the attempt has synced).
            try {
                const res = await fetch(`/api/v1/quizzes/attempts/${effectiveAttemptId}`, { headers: { Accept: 'application/json' } });
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setAttempt({ ...data.attempt, provisional: false, answersHidden: false });
                    }
                    if (localAttempt && !localAttempt.verified) {
                        await db.quizAttempts.update(localAttempt.id, {
                            score: Number(data.attempt.score),
                            total_marks: Number(data.attempt.total_marks),
                            verified: true,
                            synced: true,
                        });
                    }
                }
            } catch {
                // Offline: keep showing the provisional result from this device.
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadAttempt();
        // When the attempt syncs while this page is open, swap in the verified result.
        const onSynced = (e: Event) => {
            if ((e as CustomEvent<{ synced?: number }>).detail?.synced) void loadAttempt();
        };
        window.addEventListener(SYNC_COMPLETED_EVENT, onSynced);
        return () => {
            isMounted = false;
            window.removeEventListener(SYNC_COMPLETED_EVENT, onSynced);
        };
    }, [effectiveAttemptId]);

    const getCsrfToken = () => {
        return (
            document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || ''
        );
    };

    // AceDrill Tutor Explanation Generator (4-Part Diagnostic Offline Fallback)
    const generateOfflineExplanation = async (
        questionId: number,
        _questionText: string,
        selectedOptionId: number | null,
        answerObj?: ResultAnswer
    ): Promise<string> => {
        try {
            if (attempt?.answersHidden) {
                return `### Available once you're back online\n\nThe correct answer and a full explanation for this question appear after your attempt is verified. Your work is saved on this device and syncs automatically when the connection returns.`;
            }
            const ans = answerObj || attempt?.answers?.find((a) => a.question_id === questionId);

            let topicId: number | undefined;
            let cachedExplanation = ans?.explanation || '';
            let options = ans?.options || [];

            const quizzes = await db.quizzes.toArray();
            for (const quiz of quizzes) {
                const foundQ = quiz.questions?.find((q: any) => q.id === questionId);
                if (foundQ) {
                    topicId = foundQ.topic_id;
                    if (!cachedExplanation && foundQ.explanation) {
                        cachedExplanation = foundQ.explanation;
                    }
                    if (options.length === 0 && foundQ.options) {
                        options = foundQ.options.map((o: any) => ({
                            id: o.id,
                            option_text: o.option_text,
                            is_correct: Boolean(o.is_correct),
                        }));
                    }
                    break;
                }
            }

            let subjectName = '';
            let topicName = '';

            if (topicId) {
                setExplainTopicId(topicId);
                const topic = await db.topics.get(topicId);
                if (topic) {
                    topicName = topic.name;
                    const subject = await db.subjects.get(topic.subject_id);
                    if (subject) subjectName = subject.name;
                }
            }

            const selectedOption = selectedOptionId ? options.find((o) => o.id === selectedOptionId) : null;
            const correctOption = options.find((o) => o.is_correct);
            const isCorrect = ans?.is_correct !== undefined ? ans.is_correct : Boolean(selectedOption && selectedOption.is_correct);

            if (isCorrect && selectedOption) {
                let out = `### 1. Why Your Answer is Correct\n\n`;
                out += `You chose **"${selectedOption.option_text}"**, which is the **correct answer**! Great work applying curriculum concepts in **${topicName || 'this topic'}**.\n\n`;
                if (cachedExplanation && cachedExplanation.trim().length > 0) {
                    out += `${cachedExplanation.trim()}\n\n`;
                } else if (correctOption) {
                    out += `This answer satisfies the curriculum requirements for **${topicName || 'this subject'}**.\n\n`;
                }
                out += `### 2. A Simple Example\n\n`;
                out += `* **Key Rule:** When solving questions on **${topicName || subjectName || 'this subject'}**, check your units and definitions before finalizing your answer.`;
                return out;
            }

            let out = `### 1. Why Your Choice Was Incorrect\n\n`;
            if (selectedOption) {
                out += `You chose **"${selectedOption.option_text}"**. This choice does not satisfy the rules or formulas tested in **${topicName || 'this problem'}**.\n\n`;
            } else {
                out += `You skipped this question without selecting an option. Let's review how to solve it step by step.\n\n`;
            }

            out += `### 2. Why the Correct Answer is Right\n\n`;
            if (correctOption) {
                out += `The correct answer is **"${correctOption.option_text}"**.\n\n`;
            }
            if (cachedExplanation && cachedExplanation.trim().length > 0) {
                out += `${cachedExplanation.trim()}\n\n`;
            } else if (correctOption) {
                out += `This option is the correct solution according to curriculum standards.\n\n`;
            }

            out += `### 3. A Simple Example\n\n`;
            out += `* **Key Rule:** When solving questions on **${topicName || subjectName || 'this subject'}**, always write out given variables and standard formulas before calculating.`;

            return out;
        } catch (e) {
            console.error('Offline explanation generation error:', e);
            return `### 1. Why the Correct Answer is Right\n\nReview curriculum notes for this question.\n\n### 2. A Simple Example\n\nPractice similar questions to master this topic.`;
        }
    };

    const handleAskAI = async (
        questionId: number,
        questionText: string,
        selectedOptionId: number | null,
        answerObj?: ResultAnswer
    ) => {
        setExplainQuestionText(questionText);
        setExplainQuestionId(questionId);

        const selectedOpt = answerObj?.options.find(o => o.id === selectedOptionId);
        const correctOpt = answerObj?.options.find(o => o.is_correct);
        setExplainSelectedText(selectedOpt?.option_text || null);
        setExplainCorrectText(correctOpt?.option_text || null);

        const cacheKey = `${questionId}_${selectedOptionId ?? 'none'}`;
        if (explanationCacheRef.current[cacheKey]) {
            setExplainContent(explanationCacheRef.current[cacheKey]);
            setExplainLoading(false);
            setSidebarOpen(true);
            return;
        }

        setExplainContent('');
        setExplainLoading(true);
        setSidebarOpen(true);

        if (!navigator.onLine) {
            try {
                const offlineExp = await generateOfflineExplanation(questionId, questionText, selectedOptionId, answerObj);
                explanationCacheRef.current[cacheKey] = offlineExp;
                setExplainContent(offlineExp);
            } catch {
                setExplainContent('Could not generate offline explanation. Please try again.');
            } finally {
                setExplainLoading(false);
            }
            return;
        }

        try {
            const res = await fetch('/api/v1/ai/explain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(getCsrfToken()),
                },
                body: JSON.stringify({
                    question_id: questionId,
                    selected_option_id: selectedOptionId,
                }),
            });

            if (!res.ok) throw new Error('Failed to fetch AI explanation');
            const data = await res.json();
            const explanation = data.explanation || (await generateOfflineExplanation(questionId, questionText, selectedOptionId, answerObj));
            explanationCacheRef.current[cacheKey] = explanation;
            setExplainContent(explanation);
        } catch {
            try {
                const fallbackExp = await generateOfflineExplanation(questionId, questionText, selectedOptionId, answerObj);
                explanationCacheRef.current[cacheKey] = fallbackExp;
                setExplainContent(fallbackExp);
            } catch {
                setExplainContent('Could not generate explanation. Please check your connection or study notes.');
            }
        } finally {
            setExplainLoading(false);
        }
    };

    const percentage =
        attempt && attempt.total_marks > 0 ? Math.round((attempt.score / attempt.total_marks) * 100) : 0;

    const getScoreFeedback = (percent: number) => {
        if (percent >= 80) {
            return {
                title: 'Excellent Mastery!',
                desc: 'Outstanding performance! You know this topic very well.',
                colorClass: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20',
            };
        }
        if (percent >= 50) {
            return {
                title: 'Good Effort!',
                desc: 'Good progress! Check out the explanations below to strengthen your understanding even more.',
                colorClass: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20',
            };
        }
        return {
            title: 'Keep Practicing!',
            desc: 'Every attempt builds your knowledge! Review the step-by-step explanations below and try again to boost your score.',
            colorClass: 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20',
        };
    };

    const feedback = attempt ? getScoreFeedback(percentage) : null;

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8 animate-pulse">
                <Head title="Loading Results..." />
                <div className="max-w-4xl w-full mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[var(--color-surface)] border border-[var(--color-border)] p-6 md:p-8 rounded-3xl">
                        <div className="space-y-3 text-center md:text-left flex-1">
                            <div className="h-4 bg-[var(--color-background)]/80 rounded w-20 mx-auto md:mx-0" />
                            <div className="h-7 bg-[var(--color-background)]/80 rounded w-1/2 mx-auto md:mx-0" />
                            <div className="h-4 bg-[var(--color-background)]/80 rounded w-2/3 mx-auto md:mx-0" />
                        </div>
                        <div className="h-32 w-32 bg-[var(--color-background)]/80 rounded-full shrink-0" />
                    </div>
                    <div className="h-[74px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full" />
                </div>
            </div>
        );
    }

    if (!attempt || !feedback) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] flex items-center justify-center p-4">
                <Head title="Assessment Recorded" />
                <div className="max-w-md w-full text-center bg-[var(--color-surface)] border border-[var(--color-border)] p-8 rounded-3xl space-y-5">
                    <div className="w-16 h-16 rounded-full bg-[var(--color-primary-5)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center mx-auto shadow-sm">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold">Assessment Recorded</h1>
                    <p className="text-sm text-[var(--color-muted)]">
                        Your quiz attempt has been saved locally in your offline study vault and will automatically sync with
                        the cloud next time you connect to the internet.
                    </p>
                    <a
                        href="/subjects"
                        className="inline-block w-full py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-sm transition-all"
                    >
                        Back to Subjects
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8 relative overflow-x-hidden">
            <Head>
                <title>{`${attempt.quiz_title || 'Quiz'} Results | AceDrill`}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <div className="max-w-4xl w-full mx-auto space-y-8">
                {/* Score Summary Hero & Banner */}
                <ResultSummaryCard
                    quizTitle={attempt.quiz_title}
                    score={attempt.score}
                    totalMarks={attempt.total_marks}
                    percentage={percentage}
                    provisional={attempt.provisional}
                    feedback={feedback}
                />

                {/* Questions Review Breakdown */}
                <ResultQuestionBreakdown
                    answers={attempt.answers}
                    answersHidden={attempt.answersHidden}
                    onAskAi={handleAskAI}
                />
            </div>

            {/* AI Tutor Insights Drawer */}
            <AiExplanationDrawer
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                questionText={explainQuestionText}
                content={explainContent}
                loading={explainLoading}
                selectedOptionText={explainSelectedText}
                correctOptionText={explainCorrectText}
                questionId={explainQuestionId}
                topicId={explainTopicId}
            />
        </div>
    );
}
