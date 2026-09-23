import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { db } from '@/db/database';
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
            // 1. Try reading from Dexie first (instant offline render)
            try {
                const localAttempt = await db.quizAttempts.get(effectiveAttemptId);
                if (localAttempt && isMounted) {
                    const localQuiz = await db.quizzes.get(localAttempt.quiz_id);
                    const questions = localQuiz?.questions || [];

                    let calculatedScore = 0;
                    const answers: ResultAnswer[] = (localAttempt.answers || []).map((ans) => {
                        const question = questions.find((q) => q.id === ans.question_id);
                        const correctOption = question?.options.find((o) => o.is_correct);
                        const isCorrect = correctOption ? correctOption.id === ans.selected_option_id : ans.is_correct;
                        if (isCorrect) calculatedScore++;

                        return {
                            id: ans.id,
                            question_id: ans.question_id,
                            question_text: question?.question_text || `Question #${ans.question_id}`,
                            explanation: question?.explanation || '',
                            selected_option_id: ans.selected_option_id,
                            is_correct: Boolean(isCorrect),
                            marks_awarded: isCorrect ? 1 : 0,
                            options: (question?.options || []).map((o) => ({
                                id: o.id,
                                option_text: o.option_text,
                                is_correct: Boolean(o.is_correct),
                            })),
                        };
                    });

                    setAttempt({
                        id: localAttempt.id,
                        quiz_title:
                            localAttempt.quiz_title || localQuiz?.title || `Quiz Assessment #${localAttempt.quiz_id}`,
                        score: localAttempt.score ?? calculatedScore,
                        total_marks: localAttempt.total_marks ?? (questions.length || answers.length),
                        completed_at: localAttempt.completed_at,
                        answers: answers,
                    });
                    setLoading(false);
                }
            } catch (e) {
                console.error('Dexie attempt load error:', e);
            }

            // 2. Fetch fresh from network if online
            try {
                const res = await fetch(`/api/v1/quizzes/attempts/${attemptId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setAttempt(data.attempt);
                        setLoading(false);
                    }
                }
            } catch {
                console.log('Offline mode — loaded quiz result from local database');
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadAttempt();
        return () => {
            isMounted = false;
        };
    }, [attemptId]);

    const getCsrfToken = () => {
        return (
            document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || ''
        );
    };

    // AILEARN Tutor Explanation Generator (4-Part Diagnostic Offline Fallback)
    const generateOfflineExplanation = async (
        questionId: number,
        questionText: string,
        selectedOptionId: number | null,
        answerObj?: ResultAnswer
    ): Promise<string> => {
        try {
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

            let out = `### 1. What You Chose\n\n`;
            if (selectedOption) {
                if (selectedOption.is_correct) {
                    out += `You chose **"${selectedOption.option_text}"**, which is the **correct answer**! Great work applying curriculum concepts in **${topicName || 'this topic'}**.\n\n`;
                } else {
                    out += `You chose **"${selectedOption.option_text}"**. This option is a common trap when looking at initial numbers without applying the complete step formulas.\n\n`;
                }
            } else {
                out += `You skipped this question without selecting an option. Let's study the method so you can solve it with confidence.\n\n`;
            }

            out += `### 2. Why It Was Incorrect\n\n`;
            if (selectedOption && !selectedOption.is_correct) {
                out += `Option **"${selectedOption.option_text}"** is incorrect because it does not satisfy the rules or formulas tested in **${topicName || 'this problem'}**.\n\n`;
            } else {
                out += `Distractor options often use reversed signs, partial operations, or common calculation traps.\n\n`;
            }

            out += `### 3. What the Correct Reasoning Is\n\n`;
            if (correctOption) {
                out += `The correct answer is **"${correctOption.option_text}"**.\n\n`;
            }
            if (cachedExplanation && cachedExplanation.trim().length > 0) {
                out += `**Step-by-Step Working:**\n${cachedExplanation.trim()}\n\n`;
            } else if (correctOption) {
                out += `* The question asks: *"${questionText}"*\n* **"${correctOption.option_text}"** is the correct answer according to curriculum standards.\n\n`;
            }

            out += `### 4. A Simple Example\n\n`;
            out += `* **Key Rule:** When solving questions on **${topicName || subjectName || 'this subject'}**, always write out given variables and standard formulas before calculating.`;

            return out;
        } catch (e) {
            console.error('Offline explanation generation error:', e);
            return `### 1. What You Chose\n\nOption review.\n\n### 2. Why It Was Incorrect\n\nIncorrect calculation.\n\n### 3. What the Correct Reasoning Is\n\nReview curriculum notes for this question.\n\n### 4. A Simple Example\n\nPractice similar questions to master this topic.`;
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
                desc: 'Outstanding performance! You have fully mastered this topic and curriculum level.',
                colorClass: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20',
            };
        }
        if (percent >= 50) {
            return {
                title: 'Good Effort!',
                desc: 'Nice progress. Consider reviewing the explanations below to target your weaker spots.',
                colorClass: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20',
            };
        }
        return {
            title: 'Keep Practicing!',
            desc: 'A solid start, but you need more review. Read through the explanations and try again!',
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
                <title>{`${attempt.quiz_title || 'Assessment'} Results — AILEARN`}</title>
                <meta name="robots" content="noindex, nofollow" />
            </Head>

            <div className="max-w-4xl w-full mx-auto space-y-8">
                {/* Score Summary Hero & Banner */}
                <ResultSummaryCard
                    quizTitle={attempt.quiz_title}
                    score={attempt.score}
                    totalMarks={attempt.total_marks}
                    percentage={percentage}
                    feedback={feedback}
                />

                {/* Questions Review Breakdown */}
                <ResultQuestionBreakdown
                    answers={attempt.answers}
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
