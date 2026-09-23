import { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Lightbulb, X, Sparkles, CheckCircle2, XCircle, ArrowRight, RotateCw, Trophy, Target, Loader2, Zap, BookOpen } from 'lucide-react';
import { formatMathText } from '@/utils/mathFormatter';
import { db } from '@/db/database';

export interface SimilarPracticeOption {
    id: number;
    label?: string;
    key?: string;
    option_text: string;
    is_correct: boolean;
}

export interface SimilarPracticeQuestion {
    id: number;
    question_text: string;
    explanation?: string | null;
    topic?: { id?: number; name?: string } | null;
    subject?: { id?: number; name?: string } | null;
    options: SimilarPracticeOption[];
}

export interface AiExplanationDrawerProps {
    isOpen?: boolean;
    onClose: () => void;
    questionText?: string;
    content?: string | null;
    explanation?: string | null;
    loading: boolean;
    selectedOptionText?: string | null;
    correctOptionText?: string | null;
    questionId?: number | null;
    topicId?: number | null;
    subjectId?: number | null;
    examCode?: string | null;
    isPastQuestion?: boolean;
    answer?: {
        id?: string;
        question_id: number;
        question_text: string;
        explanation?: string;
        selected_option_id?: number | null;
        is_correct?: boolean;
        options?: Array<{ id: number; option_text: string; is_correct: boolean; label?: string }>;
    };
}

const DIAGNOSTIC_STEPS = [
    {
        title: 'Analyzing Selected Choice',
        description: 'Examining the option chosen and recognizing key question variables...',
        tip: 'Reviewing the examiner distractor pattern.',
    },
    {
        title: 'Diagnosing Misconception',
        description: 'Checking common calculation traps, sign inversions & syllabus traps...',
        tip: 'Pinpointing the exact conceptual divergence.',
    },
    {
        title: 'Formulating Step-by-Step Working',
        description: 'Structuring mathematical proof and official curriculum derivation...',
        tip: 'Formatting crystal-clear LaTeX formulas and proof.',
    },
    {
        title: 'Crafting Practical Example & Rule',
        description: 'Building an easy-to-remember exam analogy and similar problem...',
        tip: 'Almost ready! Results are cached for instant re-access.',
    },
];

export function AiExplanationDrawer({
    isOpen = true,
    onClose,
    questionText: directQuestionText,
    content: directContent,
    explanation: directExplanation,
    loading,
    selectedOptionText: directSelectedText,
    correctOptionText: directCorrectText,
    questionId: directQuestionId,
    topicId: directTopicId,
    subjectId: directSubjectId,
    examCode,
    isPastQuestion = false,
    answer,
}: AiExplanationDrawerProps) {
    // Resolve props whether passed directly or via answer object
    const questionText = directQuestionText || answer?.question_text || '';
    const rawContent = directContent || directExplanation || '';
    const questionId = directQuestionId || answer?.question_id || null;

    let selectedOptionText = directSelectedText;
    let correctOptionText = directCorrectText;

    if (answer && answer.options) {
        if (!selectedOptionText && answer.selected_option_id) {
            const found = answer.options.find(o => o.id === answer.selected_option_id);
            if (found) selectedOptionText = found.option_text;
        }
        if (!correctOptionText) {
            const found = answer.options.find(o => o.is_correct);
            if (found) correctOptionText = found.option_text;
        }
    }

    // Dynamic Pedagogical Step Cycler
    const [loadingStep, setLoadingStep] = useState(0);

    useEffect(() => {
        if (!loading) {
            setLoadingStep(0);
            return;
        }
        const interval = setInterval(() => {
            setLoadingStep(prev => (prev + 1) % DIAGNOSTIC_STEPS.length);
        }, 1500);
        return () => clearInterval(interval);
    }, [loading]);

    // Similar Question State
    const [practiceActive, setPracticeActive] = useState<boolean>(false);
    const [fetchingSimilar, setFetchingSimilar] = useState<boolean>(false);
    const [similarQuestion, setSimilarQuestion] = useState<SimilarPracticeQuestion | null>(null);
    const [practiceSelectedId, setPracticeSelectedId] = useState<number | null>(null);
    const [practiceAnswered, setPracticeAnswered] = useState<boolean>(false);
    const [practiceScoreXp, setPracticeScoreXp] = useState<number>(0);
    const [similarError, setSimilarError] = useState<string | null>(null);
    const [excludedIds, setExcludedIds] = useState<number[]>(questionId ? [questionId] : []);

    const fetchSimilarQuestion = async () => {
        setFetchingSimilar(true);
        setPracticeActive(true);
        setPracticeAnswered(false);
        setPracticeSelectedId(null);
        setSimilarError(null);

        // 1. Try fetching online API
        if (navigator.onLine) {
            try {
                const endpoint = isPastQuestion
                    ? `/api/v1/past-questions/similar?past_question_id=${questionId || ''}&topic_id=${directTopicId || ''}&subject_id=${directSubjectId || ''}&exam_code=${examCode || ''}&exclude_ids=${excludedIds.join(',')}`
                    : `/api/v1/questions/similar?question_id=${questionId || ''}&topic_id=${directTopicId || ''}&subject_id=${directSubjectId || ''}&exclude_ids=${excludedIds.join(',')}`;

                const res = await fetch(endpoint, {
                    headers: {
                        'Accept': 'application/json',
                    },
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.question) {
                        setSimilarQuestion(data.question);
                        setExcludedIds(prev => [...prev, data.question.id]);
                        setFetchingSimilar(false);
                        return;
                    }
                }
            } catch (err) {
                console.warn('Online similar question fetch failed, attempting offline database...', err);
            }
        }

        // 2. Fallback to offline Dexie IndexedDB
        try {
            const allQuizzes = await db.quizzes.toArray();
            let allQuestions: any[] = [];
            for (const qz of allQuizzes) {
                if (qz.questions && Array.isArray(qz.questions)) {
                    allQuestions.push(...qz.questions);
                }
            }

            let foundQuestions: any[] = [];
            if (directTopicId) {
                foundQuestions = allQuestions.filter(q => q.topic_id === directTopicId);
            }

            if (foundQuestions.length === 0) {
                foundQuestions = allQuestions;
            }

            // Filter out excluded IDs
            const candidates = foundQuestions.filter(q => !excludedIds.includes(q.id));
            if (candidates.length > 0) {
                const randomQ = candidates[Math.floor(Math.random() * candidates.length)];
                setSimilarQuestion({
                    id: randomQ.id,
                    question_text: randomQ.question_text,
                    explanation: randomQ.explanation,
                    options: (randomQ.options || []).map((opt: any, idx: number) => ({
                        id: opt.id || idx,
                        label: String.fromCharCode(65 + idx),
                        option_text: opt.option_text || opt.text,
                        is_correct: !!opt.is_correct,
                    })),
                });
                setExcludedIds(prev => [...prev, randomQ.id]);
            } else {
                setSimilarError('No more similar questions found in this study topic.');
            }
        } catch (e) {
            setSimilarError('Could not load a practice question right now.');
        } finally {
            setFetchingSimilar(false);
        }
    };

    const handleCheckPractice = () => {
        if (!practiceSelectedId || !similarQuestion) return;
        setPracticeAnswered(true);
        const chosen = similarQuestion.options.find(o => o.id === practiceSelectedId);
        if (chosen?.is_correct) {
            setPracticeScoreXp(prev => prev + 15);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex justify-end overflow-hidden animate-fade-in"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-xl h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="space-y-6 flex-1">
                    {/* Header */}
                    <div className="flex justify-between items-center pb-4 border-b border-[var(--color-border)]">
                        <div className="flex items-center space-x-3">
                            <span className="p-2.5 bg-[var(--color-primary-10)] text-[var(--color-primary)] rounded-xl border border-[var(--color-primary-20)] shadow-sm">
                                <Lightbulb className="w-5 h-5 text-amber-400" />
                            </span>
                            <div>
                                <h3 className="text-lg font-black text-[var(--color-text)] tracking-tight">
                                    Explain My Mistake
                                </h3>
                                <p className="text-xs font-semibold text-[var(--color-muted)]">
                                    AI Diagnostic & Mastery Loop
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-background)]/50 hover:bg-[var(--color-surface-hover)] rounded-xl transition-all border border-[var(--color-border)] cursor-pointer flex items-center justify-center"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Question Recap Box */}
                    <div className="p-4.5 bg-[var(--color-background)]/60 rounded-2xl border border-[var(--color-border)] space-y-2">
                        <span className="text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider">
                            Problem
                        </span>
                        <div className="text-sm font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {formatMathText(questionText)}
                            </Markdown>
                        </div>
                    </div>

                    {/* Answer Comparison Pill Cards */}
                    {(selectedOptionText || correctOptionText) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {selectedOptionText && (
                                <div className="p-3.5 rounded-2xl bg-[var(--color-error-5)] border border-[var(--color-error)]/30 space-y-1">
                                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-error)]">
                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                        Your Answer
                                    </span>
                                    <div className="text-xs font-bold text-[var(--color-text)] chat-markdown [&_p]:inline">
                                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {formatMathText(selectedOptionText)}
                                        </Markdown>
                                    </div>
                                </div>
                            )}

                            {correctOptionText && (
                                <div className="p-3.5 rounded-2xl bg-[var(--color-success-5)] border border-[var(--color-success)]/30 space-y-1">
                                    <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-success)]">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        Correct Answer
                                    </span>
                                    <div className="text-xs font-bold text-[var(--color-text)] chat-markdown [&_p]:inline">
                                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {formatMathText(correctOptionText)}
                                        </Markdown>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI Explanation Markdown Content */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="p-6 rounded-3xl bg-[var(--color-surface-hover)] border-2 border-[var(--color-primary-20)] space-y-6 animate-fade-in shadow-sm">
                                {/* Top Header Badge */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="p-2 rounded-xl bg-[var(--color-primary)] text-white shadow-sm">
                                            <Sparkles className="w-4 h-4 text-[var(--color-accent)] animate-pulse" />
                                        </span>
                                        <div>
                                            <div className="text-xs font-black uppercase tracking-wider text-[var(--color-primary)]">
                                                AI Diagnostic Tutor
                                            </div>
                                            <div className="text-[11px] font-semibold text-[var(--color-muted)]">
                                                Formulating pedagogical breakdown
                                            </div>
                                        </div>
                                    </div>
                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] text-[11px] font-black border border-[var(--color-primary-20)]">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-primary)]" />
                                        Step {loadingStep + 1} of 4
                                    </span>
                                </div>

                                {/* Stepped Progress Dots */}
                                <div className="grid grid-cols-4 gap-2">
                                    {DIAGNOSTIC_STEPS.map((step, idx) => {
                                        const isDone = idx < loadingStep;
                                        const isActive = idx === loadingStep;
                                        return (
                                            <div key={idx} className="space-y-1.5">
                                                <div
                                                    className={`h-2 rounded-full transition-all duration-500 ${
                                                        isActive
                                                            ? 'bg-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/30 animate-pulse'
                                                            : isDone
                                                            ? 'bg-[var(--color-primary)]'
                                                            : 'bg-[var(--color-border)]'
                                                    }`}
                                                />
                                                <div className={`text-[10px] font-bold text-center truncate ${isActive ? 'text-[var(--color-primary)]' : isDone ? 'text-[var(--color-text)]' : 'text-[var(--color-muted)]'}`}>
                                                    {idx + 1}. {step.title.split(' ')[0]}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Active Diagnostic Phase Card */}
                                <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2 shadow-inner">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-ping" />
                                        <h4 className="text-sm font-black text-[var(--color-text)]">
                                            {DIAGNOSTIC_STEPS[loadingStep].title}
                                        </h4>
                                    </div>
                                    <p className="text-xs text-[var(--color-muted)] font-medium leading-relaxed">
                                        {DIAGNOSTIC_STEPS[loadingStep].description}
                                    </p>
                                    <div className="pt-2 border-t border-[var(--color-border)] flex items-center gap-2 text-[11px] font-bold text-[var(--color-primary)]">
                                        <Zap className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
                                        <span>{DIAGNOSTIC_STEPS[loadingStep].tip}</span>
                                    </div>
                                </div>

                                {/* Caching & Speed Guarantee Note */}
                                <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--color-muted)] font-medium text-center">
                                    <BookOpen className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                                    <span>Explanation will be cached instantly for fast re-checking.</span>
                                </div>
                            </div>
                        ) : rawContent ? (
                            <div className="p-5 bg-[var(--color-background)]/80 rounded-2xl border border-[var(--color-border)] chat-markdown text-[var(--color-text)] text-sm leading-relaxed space-y-3.5 font-medium">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {formatMathText(rawContent)}
                                </Markdown>
                            </div>
                        ) : (
                            <div className="p-6 text-center border border-dashed border-[var(--color-border)] rounded-2xl">
                                <p className="text-xs text-[var(--color-muted)] font-semibold">
                                    No detailed explanation available. Check your offline study notes.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Mastery Practice Widget: "Try Another Similar Question" */}
                    <div className="pt-2">
                        {!practiceActive ? (
                            <button
                                type="button"
                                onClick={fetchSimilarQuestion}
                                className="w-full p-4 rounded-2xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] border border-[var(--color-primary-light)]/30 text-white font-extrabold text-sm flex items-center justify-between shadow-md shadow-[var(--color-primary)]/15 transition-all cursor-pointer transform hover:-translate-y-0.5"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="p-2 bg-white/10 rounded-xl border border-white/10 text-[var(--color-accent)]">
                                        <Target className="w-5 h-5 text-[var(--color-accent)]" />
                                    </span>
                                    <div className="text-left">
                                        <div className="text-sm font-black">Try Another Similar Question</div>
                                        <div className="text-[11px] text-white/80 font-medium">Practice & verify concept mastery immediately</div>
                                    </div>
                                </div>
                                <ArrowRight className="w-5 h-5 shrink-0 text-white/90" />
                            </button>
                        ) : (
                            <div className="p-5 rounded-3xl bg-[var(--color-surface-hover)] border-2 border-[var(--color-primary-20)] space-y-4 animate-fade-in shadow-xl">
                                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-[var(--color-primary)]" />
                                        <span className="text-xs font-black uppercase tracking-wider text-[var(--color-primary)]">
                                            Concept Practice Challenge
                                        </span>
                                    </div>
                                    {practiceScoreXp > 0 && (
                                        <span className="flex items-center gap-1 text-[11px] font-black text-[var(--color-accent)] bg-[var(--color-accent-10)] px-2.5 py-0.5 rounded-full border border-[var(--color-accent-20)]">
                                            <Trophy className="w-3.5 h-3.5" />
                                            +{practiceScoreXp} XP
                                        </span>
                                    )}
                                </div>

                                {fetchingSimilar ? (
                                    <div className="py-8 text-center space-y-2">
                                        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary)] mx-auto" />
                                        <p className="text-xs font-bold text-[var(--color-muted)]">
                                            Loading practice question from this topic...
                                        </p>
                                    </div>
                                ) : similarQuestion ? (
                                    <div className="space-y-4">
                                        <div className="text-sm font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {formatMathText(similarQuestion.question_text)}
                                            </Markdown>
                                        </div>

                                        {/* Options */}
                                        <div className="space-y-2">
                                            {similarQuestion.options.map((opt, idx) => {
                                                const isSelected = practiceSelectedId === opt.id;
                                                const isCorrect = opt.is_correct;

                                                let style = 'border-[var(--color-border)] bg-[var(--color-background)]/50 hover:border-[var(--color-primary-light)]';
                                                let badge = 'bg-[var(--color-surface)] text-[var(--color-muted)]';

                                                if (practiceAnswered) {
                                                    if (isCorrect) {
                                                        style = 'border-[var(--color-success)] bg-[var(--color-success-10)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]';
                                                        badge = 'bg-[var(--color-success)] text-white';
                                                    } else if (isSelected && !isCorrect) {
                                                        style = 'border-[var(--color-error)] bg-[var(--color-error-10)] text-[var(--color-error)] ring-1 ring-[var(--color-error)]';
                                                        badge = 'bg-[var(--color-error)] text-white';
                                                    } else {
                                                        style = 'border-[var(--color-border)] opacity-50 bg-[var(--color-background)]/20';
                                                    }
                                                } else if (isSelected) {
                                                    style = 'border-[var(--color-primary)] bg-[var(--color-primary-10)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary-20)]';
                                                    badge = 'bg-[var(--color-primary)] text-white';
                                                }

                                                return (
                                                    <button
                                                        key={opt.id}
                                                        type="button"
                                                        disabled={practiceAnswered}
                                                        onClick={() => setPracticeSelectedId(opt.id)}
                                                        className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer disabled:cursor-default ${style}`}
                                                    >
                                                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${badge}`}>
                                                            {opt.label || String.fromCharCode(65 + idx)}
                                                        </span>
                                                        <div className="flex-1 text-xs font-bold text-[var(--color-text)] chat-markdown [&_p]:inline pt-0.5">
                                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                                {formatMathText(opt.option_text)}
                                                            </Markdown>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {/* Action: Check Answer or Next */}
                                        {!practiceAnswered ? (
                                            <button
                                                type="button"
                                                disabled={!practiceSelectedId}
                                                onClick={handleCheckPractice}
                                                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle2 className="w-4 h-4" />
                                                Check Answer
                                            </button>
                                        ) : (
                                            <div className="space-y-3 animate-fade-in">
                                                {similarQuestion.options.find(o => o.id === practiceSelectedId)?.is_correct ? (
                                                    <div className="p-3 bg-[var(--color-success-10)] border border-[var(--color-success-20)] rounded-xl text-center space-y-1">
                                                        <div className="text-xs font-black text-[var(--color-success)] flex items-center justify-center gap-1.5">
                                                            <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                                                            Mastery Verified! +15 XP Earned
                                                        </div>
                                                        <p className="text-[11px] text-[var(--color-muted)]">
                                                            You applied the correct logic to solve this similar problem!
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-[var(--color-error-10)] border border-[var(--color-error-20)] rounded-xl text-center space-y-1">
                                                        <div className="text-xs font-black text-[var(--color-error)]">
                                                            Keep Practicing!
                                                        </div>
                                                        <p className="text-[11px] text-[var(--color-muted)]">
                                                            Review the 4-step explanation above and try another problem.
                                                        </p>
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={fetchSimilarQuestion}
                                                    className="w-full py-2.5 bg-[var(--color-surface)] hover:bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text)] text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                                                >
                                                    <RotateCw className="w-3.5 h-3.5" />
                                                    Try Another Practice Question
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-4 text-center space-y-3">
                                        <p className="text-xs text-[var(--color-muted)]">
                                            {similarError || 'No additional practice questions found.'}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => setPracticeActive(false)}
                                            className="px-4 py-2 bg-[var(--color-background)] border border-[var(--color-border)] text-xs font-bold rounded-xl cursor-pointer"
                                        >
                                            Back to Explanation
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-6 border-t border-[var(--color-border)] mt-8">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full inline-flex items-center justify-center py-3 bg-[var(--color-background)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-bold transition-all min-h-[44px] cursor-pointer text-sm"
                    >
                        Done Reviewing
                    </button>
                </div>
            </div>
        </div>
    );
}
