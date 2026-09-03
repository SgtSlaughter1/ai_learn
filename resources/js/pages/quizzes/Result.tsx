import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
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

    // AI Explainer Sidebar States
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [explainQuestionText, setExplainQuestionText] = useState<string>('');
    const [explainContent, setExplainContent] = useState<string>('');
    const [explainLoading, setExplainLoading] = useState<boolean>(false);

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

    // AILEARN Tutor Explanation Generator
    const generateOfflineExplanation = async (
        questionId: number,
        questionText: string,
        selectedOptionId: number | null
    ): Promise<string> => {
        try {
            const ans = attempt?.answers?.find((a) => a.question_id === questionId);

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
            let topicLevel = '';

            if (topicId) {
                const topic = await db.topics.get(topicId);
                if (topic) {
                    topicName = topic.name;
                    topicLevel = topic.level;
                    const subject = await db.subjects.get(topic.subject_id);
                    if (subject) subjectName = subject.name;
                }
            }

            const selectedOption = selectedOptionId ? options.find((o) => o.id === selectedOptionId) : null;
            const correctOption = options.find((o) => o.is_correct);

            let out = `### 📚 AILEARN Tutor Explanation\n\n`;

            if (subjectName || topicName) {
                out += `**Curriculum Topic:** ${subjectName ? subjectName + ' → ' : ''}**${topicName || 'General Practice'}** ${
                    topicLevel ? `(Level: ${topicLevel.toUpperCase()})` : ''
                }\n\n`;
            }

            if (selectedOption) {
                if (selectedOption.is_correct) {
                    out += `🎉 **Correct!** You selected **"${selectedOption.option_text}"**, which is the right answer.\n\n`;
                } else {
                    out += `❌ **Incorrect Choice:** You chose **"${selectedOption.option_text}"**. Let's review why this isn't correct and how to find the right answer.\n\n`;
                }
            } else {
                out += `⏳ **Skipped Question:** You didn't select an answer. Let's study the correct answer together.\n\n`;
            }

            if (correctOption) {
                out += `#### Why the correct answer is "${correctOption.option_text}":\n\n`;
            }

            if (cachedExplanation && cachedExplanation.trim().length > 0) {
                out += `${cachedExplanation.trim()}\n\n`;
            } else if (correctOption) {
                out += `* The question asks: *"${questionText}"*\n* **"${correctOption.option_text}"** is the correct answer according to your curriculum standards.\n\n`;
            }

            const otherOptions = options.filter((o) => !o.is_correct);
            if (otherOptions.length > 0) {
                out += `#### Review of other choices:\n\n`;
                otherOptions.forEach((opt) => {
                    const isUserChoice = opt.id === selectedOptionId;
                    if (isUserChoice) {
                        out += `* ❌ **"${opt.option_text}"** *(Your choice)* — Does not satisfy the key requirement for this question.\n`;
                    } else {
                        out += `* ⚪ **"${opt.option_text}"** — Incorrect choice for this question.\n`;
                    }
                });
                out += `\n`;
            }

            out += `---\n\n`;
            out += `💡 **Study Tip:** Review the core notes on **${topicName || 'this subject'}**. Practicing similar questions will help reinforce this concept!`;

            return out;
        } catch (e) {
            console.error('Offline explanation generation error:', e);
            return `### 📚 AILEARN Tutor\n\n**Question:** ${questionText}\n\nReview your answer and study notes for this question. Your offline progress has been saved.`;
        }
    };

    const handleAskAI = async (questionId: number, questionText: string, selectedOptionId: number | null) => {
        setExplainQuestionText(questionText);
        setExplainContent('');
        setExplainLoading(true);
        setSidebarOpen(true);

        if (!navigator.onLine) {
            try {
                const offlineExp = await generateOfflineExplanation(questionId, questionText, selectedOptionId);
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
            setExplainContent(data.explanation);
        } catch {
            try {
                const fallbackExp = await generateOfflineExplanation(questionId, questionText, selectedOptionId);
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
                    <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mx-auto text-2xl font-black">
                        ✓
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
            <Head title="Assessment Results" />

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
            />
        </div>
    );
}
