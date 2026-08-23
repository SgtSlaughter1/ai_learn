import { Head, Link } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface Option {
    id: number;
    option_text: string;
    is_correct: boolean;
}

interface Answer {
    id: string;
    question_id: number;
    question_text: string;
    explanation: string;
    selected_option_id: number | null;
    is_correct: boolean;
    marks_awarded: number;
    options: Option[];
}

interface Attempt {
    id: string;
    quiz_title: string;
    score: number;
    total_marks: number;
    completed_at: string | null;
    answers: Answer[];
}

interface Props {
    attemptId: string;
}

export default function Result({ attemptId }: Props) {
    const [loading, setLoading] = useState<boolean>(true);
    const [attempt, setAttempt] = useState<Attempt | null>(null);

    // AI Explainer Sidebar States
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [explainQuestionText, setExplainQuestionText] = useState<string>('');
    const [explainContent, setExplainContent] = useState<string>('');
    const [explainLoading, setExplainLoading] = useState<boolean>(false);

    useEffect(() => {
        let isMounted = true;

        fetch(`/api/v1/quizzes/attempts/${attemptId}`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to fetch attempt details');
                return res.json();
            })
            .then((data) => {
                if (isMounted) {
                    setAttempt(data.attempt);
                    setLoading(false);
                }
            })
            .catch((err) => {
                console.error(err);
                if (isMounted) setLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [attemptId]);

    // Helper to get CSRF token
    const getCsrfToken = () => {
        return document.cookie
            .split('; ')
            .find(row => row.startsWith('XSRF-TOKEN='))
            ?.split('=')[1] || '';
    };

    const handleAskAI = async (questionId: number, questionText: string, selectedOptionId: number | null) => {
        setExplainQuestionText(questionText);
        setExplainContent('');
        setExplainLoading(true);
        setSidebarOpen(true);

        try {
            const res = await fetch('/api/v1/ai/explain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(getCsrfToken())
                },
                body: JSON.stringify({
                    question_id: questionId,
                    selected_option_id: selectedOptionId
                })
            });

            if (!res.ok) throw new Error('Failed to fetch AI explanation');
            const data = await res.json();
            setExplainContent(data.explanation);
        } catch (error) {
            console.error(error);
            setExplainContent('⚠️ Could not connect to AI Tutor. Please check your offline connection or try again.');
        } finally {
            setExplainLoading(false);
        }
    };

    const percentage = attempt && attempt.total_marks > 0
        ? Math.round((attempt.score / attempt.total_marks) * 100)
        : 0;

    const getScoreFeedback = (percent: number) => {
        if (percent >= 80) {
            return {
                title: 'Excellent Mastery!',
                desc: 'Outstanding performance! You have fully mastered this topic and curriculum level.',
                colorClass: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20'
            };
        }
        if (percent >= 50) {
            return {
                title: 'Good Effort!',
                desc: 'Nice progress. Consider reviewing the explanations below to target your weaker spots.',
                colorClass: 'text-[var(--color-accent)] bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20'
            };
        }
        return {
            title: 'Keep Practicing!',
            desc: 'A solid start, but you need more review. Read through the explanations and try again!',
            colorClass: 'text-[var(--color-error)] bg-[var(--color-error)]/10 border-[var(--color-error)]/20'
        };
    };

    const feedback = attempt ? getScoreFeedback(percentage) : null;

    if (loading || !attempt || !feedback) {
        return (
            <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8 animate-pulse">
                <Head title="Loading Results..." />
                
                <div className="max-w-4xl w-full mx-auto space-y-8">
                    {/* Header skeleton */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[var(--color-surface)] border border-[var(--color-border)] p-6 md:p-8 rounded-3xl">
                        <div className="space-y-3 text-center md:text-left flex-1">
                            <div className="h-4 bg-[var(--color-background)]/80 rounded w-20 mx-auto md:mx-0" />
                            <div className="h-7 bg-[var(--color-background)]/80 rounded w-1/2 mx-auto md:mx-0" />
                            <div className="h-4 bg-[var(--color-background)]/80 rounded w-2/3 mx-auto md:mx-0" />
                        </div>
                        <div className="h-32 w-32 bg-[var(--color-background)]/80 rounded-full shrink-0" />
                    </div>

                    {/* Alert Banner skeleton */}
                    <div className="h-[74px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl w-full" />
                    
                    {/* Questions skeleton */}
                    <div className="space-y-6">
                        <div className="h-5 bg-[var(--color-surface)] rounded w-1/4" />
                        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 md:p-8 rounded-3xl h-[280px]" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-text)] p-4 md:p-8 relative overflow-x-hidden">
            <Head title="Assessment Results" />

            <div className="max-w-4xl w-full mx-auto space-y-8">
                {/* Header card */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-[var(--color-surface)] border border-[var(--color-border)] p-6 md:p-8 rounded-3xl backdrop-blur-md">
                    <div className="space-y-3 text-center md:text-left">
                        <span className="text-[10px] font-extrabold px-2.5 py-1 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-md tracking-wider uppercase">
                            Assessment Completed
                        </span>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--color-text)] leading-tight">
                            {attempt.quiz_title}
                        </h1>
                        <p className="text-[var(--color-muted)] text-sm max-w-xl leading-relaxed">
                            {feedback.desc}
                        </p>
                    </div>

                    {/* Circular Radial Score Dial */}
                    <div className="relative h-32 w-32 flex items-center justify-center bg-[var(--color-background)]/60 rounded-full border border-[var(--color-border)] shadow-inner shrink-0">
                        <svg className="absolute inset-0 transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                                cx="50"
                                cy="50"
                                r="42"
                                className="stroke-slate-850"
                                strokeWidth="8"
                                fill="transparent"
                            />
                            <circle
                                cx="50"
                                cy="50"
                                r="42"
                                className={`transition-all duration-1000 ${
                                    percentage >= 80 ? 'stroke-emerald-500' : percentage >= 50 ? 'stroke-amber-500' : 'stroke-rose-500'
                                }`}
                                strokeWidth="8"
                                fill="transparent"
                                strokeDasharray={263.89}
                                strokeDashoffset={263.89 - (263.89 * percentage) / 100}
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="text-center">
                            <span className="block text-2xl font-black text-[var(--color-text)]">{percentage}%</span>
                            <span className="block text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                                {attempt.score}/{attempt.total_marks} Marks
                            </span>
                        </div>
                    </div>
                </div>

                {/* Score badge Alert banner */}
                <div className={`p-5 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-4 ${feedback.colorClass}`}>
                    <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{feedback.title}</span>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/dashboard"
                            className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-text)] hover:text-white px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-slate-700 transition-colors cursor-pointer min-h-[38px] flex items-center"
                        >
                            Go to Dashboard
                        </Link>
                    </div>
                </div>

                {/* Answers review section */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-[var(--color-text)]">Questions Review</h2>

                    {attempt.answers.map((answer, idx) => (
                        <div
                            key={answer.id}
                            className="bg-[var(--color-surface)] backdrop-blur-md border border-[var(--color-border)] p-6 md:p-8 rounded-3xl space-y-6"
                        >
                            {/* Question Title & Score mapping */}
                            <div className="flex justify-between items-start gap-4">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                                        Question {idx + 1}
                                    </span>
                                    <h3 className="text-lg font-bold text-[var(--color-text)] leading-relaxed">
                                        {answer.question_text}
                                    </h3>
                                </div>
                                <div className="flex items-center space-x-2 shrink-0">
                                    <button
                                        onClick={() => handleAskAI(answer.question_id, answer.question_text, answer.selected_option_id)}
                                        className="text-xs font-bold px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)] text-white rounded-lg transition-colors shadow-lg shadow-[var(--color-primary)]/10 min-h-[36px] flex items-center gap-1.5 focus:outline-none"
                                    >
                                        <span>✨ Ask AI</span>
                                    </button>
                                    <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border uppercase ${
                                        answer.is_correct
                                            ? 'bg-[var(--color-success)]/10 text-[var(--color-success)] border-[var(--color-success)]/20'
                                            : 'bg-[var(--color-error)]/10 text-[var(--color-error)] border-[var(--color-error)]/20'
                                    }`}>
                                        {answer.is_correct ? `+${answer.marks_awarded} Marks` : 'Incorrect'}
                                    </span>
                                </div>
                            </div>

                            {/* Options review layout */}
                            <div className="space-y-3">
                                {answer.options.map((option) => {
                                    const isSelected = answer.selected_option_id === option.id;
                                    const isCorrect = option.is_correct;

                                    let optionClass = 'border-[var(--color-border)] text-[var(--color-muted)] bg-[var(--color-background)]/20';
                                    if (isCorrect) {
                                        optionClass = 'border-emerald-500 bg-[var(--color-success)]/10 text-emerald-300';
                                    } else if (isSelected && !isCorrect) {
                                        optionClass = 'border-rose-500 bg-[var(--color-error)]/10 text-rose-300';
                                    }

                                    return (
                                        <div
                                            key={option.id}
                                            className={`px-5 py-3.5 rounded-xl border text-sm font-semibold flex items-center justify-between ${optionClass}`}
                                        >
                                            <span>{option.option_text}</span>
                                            <div className="flex items-center space-x-2">
                                                {isSelected && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
                                                        Your choice
                                                    </span>
                                                )}
                                                {isCorrect ? (
                                                    <svg className="w-5 h-5 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : isSelected && !isCorrect ? (
                                                    <svg className="w-5 h-5 text-[var(--color-error)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                ) : null}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Explanation Box */}
                            {answer.explanation && (
                                <div className="p-5 bg-teal-950/20 border border-teal-500/10 rounded-2xl space-y-1.5">
                                    <span className="block text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">
                                        Answer Explanation
                                    </span>
                                    <div className="chat-markdown text-sm text-[var(--color-muted)] leading-relaxed">
                                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{answer.explanation}</Markdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Explanation Slide-out Glassmorphic Sidebar */}
            <div className={`fixed inset-0 z-50 transition-all duration-350 ${
                sidebarOpen ? 'pointer-events-auto bg-black/40 backdrop-blur-sm' : 'pointer-events-none bg-black/0 backdrop-blur-none'
            }`} onClick={() => setSidebarOpen(false)}>
                <div 
                    className={`absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[var(--color-surface)]/95 backdrop-blur-xl border-l border-[var(--color-border)] shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-out transform ${
                        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="space-y-6 flex-1">
                        <div className="flex justify-between items-center pb-4 border-b border-[var(--color-border)]">
                            <div className="flex items-center space-x-2">
                                <span className="p-2 bg-[var(--color-primary)]/15 text-[var(--color-primary)] rounded-lg">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364.364l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                </span>
                                <h3 className="text-lg font-extrabold text-[var(--color-text)]">AI Tutor Insights</h3>
                            </div>
                            <button 
                                onClick={() => setSidebarOpen(false)}
                                className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-background)]/40 hover:bg-[var(--color-primary-5)]/60 rounded-xl transition-all border border-[var(--color-border)] cursor-pointer min-h-[38px] flex items-center justify-center"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Question Text in Sidebar */}
                        <div className="p-4.5 bg-[var(--color-background)]/40 rounded-2xl border border-[var(--color-border)]">
                            <span className="block text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">Question</span>
                            <p className="text-sm font-semibold text-[var(--color-text)] leading-relaxed">
                                {explainQuestionText}
                            </p>
                        </div>

                        {/* AI Explanation Markdown Content */}
                        <div className="space-y-4">
                            {explainLoading ? (
                                <div className="space-y-4 py-8 animate-pulse text-center">
                                    <div className="h-6 bg-[var(--color-background)]/80 rounded w-1/3 mx-auto" />
                                    <div className="h-4 bg-[var(--color-background)]/80 rounded w-5/6 mx-auto" />
                                    <div className="h-4 bg-[var(--color-background)]/80 rounded w-2/3 mx-auto" />
                                    <div className="h-4 bg-[var(--color-background)]/80 rounded w-4/5 mx-auto" />
                                    <p className="text-xs text-[var(--color-primary)] font-bold tracking-wider mt-4">Consulting LLM models...</p>
                                </div>
                            ) : (
                                <div className="chat-markdown text-[var(--color-text)] text-sm leading-relaxed space-y-3 font-medium">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{explainContent}</Markdown>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[var(--color-border)] mt-8">
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="w-full inline-flex items-center justify-center py-3 bg-[var(--color-background)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-bold transition-all min-h-[48px]"
                        >
                            Got It, Thanks!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
