import React, { useState, useRef } from 'react';
import { RichText } from '@/components/common/RichText';
import 'katex/dist/katex.min.css';
import { PastQuestionItem } from '../../types/past-questions';
import { AiExplanationDrawer } from '../quiz/AiExplanationDrawer';
import { Sparkles, Lightbulb, BookOpen } from 'lucide-react';
import { formatMathText, extractLiteratureContext } from '../../utils/mathFormatter';
import { reviewAnswer } from '@/services/AnswerKey';

interface Props {
    questions: PastQuestionItem[];
    examTitle: string;
    subjectTitle: string;
    yearTitle?: string;
    onClose: () => void;
}

export const ExamPracticeModal: React.FC<Props> = ({
    questions,
    examTitle,
    subjectTitle,
    yearTitle,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [verifiedAnswers, setVerifiedAnswers] = useState<Record<number, {
        isCorrect: boolean;
        correctOptionId: number | null;
        explanation?: string | null;
        /** Offline without the answer key: the answer can't be checked yet. */
        unverified?: boolean;
    }>>({});
    const [bookmarked, setBookmarked] = useState<Record<number, boolean>>({});

    // AI Tutor State & In-Memory Cache
    const [aiTutorOpen, setAiTutorOpen] = useState<boolean>(false);
    const [aiTutorContent, setAiTutorContent] = useState<string>('');
    const [aiTutorLoading, setAiTutorLoading] = useState<boolean>(false);
    const explanationCacheRef = useRef<Record<string, string>>({});

    // Safe bounds enforcement
    const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, questions.length - 1));
    const currentQ = questions[safeIndex];

    const selectedOptId = currentQ ? selectedAnswers[currentQ.id] : undefined;
    const isAnswered = selectedOptId !== undefined;
    const verification = currentQ ? verifiedAnswers[currentQ.id] : undefined;
    const isCorrect = verification?.isCorrect ?? (currentQ?.options.find(o => o.id === selectedOptId)?.is_correct ?? false);
    const correctOptionId = verification?.correctOptionId ?? currentQ?.options.find(o => o.is_correct)?.id;

    const toggleBookmark = () => {
        if (!currentQ) return;
        setBookmarked(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
    };

    const handleSelectOption = async (optId: number) => {
        if (!currentQ || isAnswered) return;

        setSelectedAnswers(prev => ({ ...prev, [currentQ.id]: optId }));

        // If options already include is_correct (e.g. offline cache bundle)
        const localCorrectOpt = currentQ.options.find(o => o.is_correct);
        if (localCorrectOpt) {
            setVerifiedAnswers(prev => ({
                ...prev,
                [currentQ.id]: {
                    isCorrect: localCorrectOpt.id === optId,
                    correctOptionId: localCorrectOpt.id,
                    explanation: currentQ.explanation,
                },
            }));
            return;
        }

        // Checked on the device from the answer hash (works offline, no request needed);
        // the correct option and explanation are only unlocked by checking.
        if (currentQ.answer_hash) {
            const review = await reviewAnswer('pq', currentQ, optId);
            if (review.correctOptionId !== null) {
                setVerifiedAnswers(prev => ({
                    ...prev,
                    [currentQ.id]: {
                        isCorrect: review.isCorrect,
                        correctOptionId: review.correctOptionId,
                        explanation: review.explanation,
                    },
                }));
                return;
            }
        }

        // Server-side secure verification without leaking answers in advance
        if (navigator.onLine) {
            try {
                const res = await fetch('/api/v1/past-questions/verify-answer', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        question_id: currentQ.id,
                        selected_option_id: optId,
                    }),
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    setVerifiedAnswers(prev => ({
                        ...prev,
                        [currentQ.id]: {
                            isCorrect: data.is_correct,
                            correctOptionId: data.correct_option_id,
                            explanation: data.explanation,
                        },
                    }));
                    return;
                }
            } catch (err) {
                console.error('Answer verification error, using fallback:', err);
            }
        }

        // Offline: answer keys stay on the server, so say the answer can't be checked yet
        // rather than marking it wrong and pointing at an arbitrary option.
        setVerifiedAnswers(prev => ({
            ...prev,
            [currentQ.id]: {
                isCorrect: false,
                correctOptionId: null,
                explanation: currentQ.explanation,
                unverified: true,
            },
        }));
    };

    // Keyboard Shortcuts for Authentic CBT Experience
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isTyping = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                (activeEl as HTMLElement).isContentEditable
            );
            if (isTyping) return;

            // Escape closes AI Tutor drawer first if open, else closes modal
            if (e.key === 'Escape') {
                e.preventDefault();
                if (aiTutorOpen) {
                    setAiTutorOpen(false);
                } else {
                    onClose();
                }
                return;
            }

            if (aiTutorOpen) return;

            // Navigation: Next (ArrowRight, N) and Previous (ArrowLeft, P)
            if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
                e.preventDefault();
                setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1));
                return;
            }
            if (e.key === 'ArrowLeft' || e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                setCurrentIndex(prev => Math.max(0, prev - 1));
                return;
            }

            // Bookmark: B key
            if (e.key === 'b' || e.key === 'B') {
                e.preventDefault();
                toggleBookmark();
                return;
            }

            // AI Explanation / Help: H or E (when answered)
            if (e.key === 'h' || e.key === 'H' || (isAnswered && (e.key === 'e' || e.key === 'E'))) {
                e.preventDefault();
                handleAskAiTutor();
                return;
            }

            // CBT Option Selection: A-E or 1-5 keys
            if (!isAnswered && currentQ?.options?.length > 0) {
                const key = e.key.toUpperCase();
                let targetIdx = -1;
                if (key === 'A' || key === '1') targetIdx = 0;
                else if (key === 'B' || key === '2') targetIdx = 1;
                else if (key === 'C' || key === '3') targetIdx = 2;
                else if (key === 'D' || key === '4') targetIdx = 3;
                else if (key === 'E' || key === '5') targetIdx = 4;

                if (targetIdx >= 0 && targetIdx < currentQ.options.length) {
                    e.preventDefault();
                    handleSelectOption(currentQ.options[targetIdx].id);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, isAnswered, aiTutorOpen, currentQ, questions.length, onClose]);

    const selectedOpt = currentQ.options.find(o => o.id === selectedOptId);
    const correctOpt = currentQ.options.find(o => o.id === correctOptionId) || currentQ.options.find(o => o.is_correct);

    const generateOfflineExplanation = () => {
        const topicName = currentQ.topic?.name || '';
        const subjectName = currentQ.subject?.name || '';
        const isCorrect = selectedOpt && selectedOpt.is_correct;

        if (isCorrect) {
            let out = `### 1. Why Your Answer is Correct\n\n`;
            out += `You chose **"${selectedOpt.label || ''} ${selectedOpt.option_text}"**, which is the **correct answer** for ${currentQ.exam_code || 'this exam'}! Great work.\n\n`;
            if (currentQ.explanation && currentQ.explanation.trim().length > 0) {
                out += `${currentQ.explanation.trim()}\n\n`;
            } else if (correctOpt) {
                out += `This solution satisfies the official marking scheme for **${topicName || subjectName || 'this subject'}**.\n\n`;
            }
            out += `### 2. A Simple Example\n\n`;
            out += `* **Key Rule:** When tackling questions on **${topicName || 'this topic'}**, remember the underlying principle and check your working carefully.`;
            return out;
        }

        let out = `### 1. Why Your Choice Was Incorrect\n\n`;
        if (selectedOpt) {
            out += `You chose **"${selectedOpt.label || ''} ${selectedOpt.option_text}"**. This choice does not satisfy the marking scheme or formulas tested in **${topicName || subjectName || 'this question'}**.\n\n`;
        } else {
            out += `You have not selected an option yet. Here is how to approach this question.\n\n`;
        }

        out += `### 2. Why the Correct Answer is Right\n\n`;
        if (correctOpt) {
            out += `The correct answer is **"${correctOpt.label || ''} ${correctOpt.option_text}"**.\n\n`;
        }
        if (currentQ.explanation && currentQ.explanation.trim().length > 0) {
            out += `${currentQ.explanation.trim()}\n\n`;
        } else if (correctOpt) {
            out += `This is the official solution according to the examination syllabus.\n\n`;
        }

        out += `### 3. A Simple Example\n\n`;
        out += `* **Key Rule:** When tackling **${subjectName || 'exam'}** questions on **${topicName || 'this topic'}**, write down known formulas and double-check unit conversions before picking an option.`;

        return out;
    };

    const handleAskAiTutor = async () => {
        const cacheKey = `${currentQ.id}_${selectedOptId ?? 'none'}`;
        if (explanationCacheRef.current[cacheKey]) {
            setAiTutorContent(explanationCacheRef.current[cacheKey]);
            setAiTutorLoading(false);
            setAiTutorOpen(true);
            return;
        }

        setAiTutorContent('');
        setAiTutorOpen(true);
        setAiTutorLoading(true);

        if (!navigator.onLine) {
            const offlineExp = generateOfflineExplanation();
            explanationCacheRef.current[cacheKey] = offlineExp;
            setAiTutorContent(offlineExp);
            setAiTutorLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/v1/past-questions/explain', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    past_question_id: currentQ.id,
                    selected_option_id: selectedOptId,
                }),
            });
            const data = await res.json();
            const explanation = (data.success && data.explanation) ? data.explanation : generateOfflineExplanation();
            explanationCacheRef.current[cacheKey] = explanation;
            setAiTutorContent(explanation);
        } catch {
            const fallbackExp = generateOfflineExplanation();
            explanationCacheRef.current[cacheKey] = fallbackExp;
            setAiTutorContent(fallbackExp);
        } finally {
            setAiTutorLoading(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fade-in">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header Bar */}
                <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                {currentQ.exam_code ? currentQ.exam_code.toUpperCase() : examTitle}
                            </span>
                            {(currentQ.exam_year || yearTitle) && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                    Year {currentQ.exam_year || yearTitle}
                                </span>
                            )}
                            <span className="text-xs font-semibold text-[var(--color-muted)] truncate max-w-[120px] sm:max-w-none">
                                {currentQ.subject?.name || subjectTitle}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)]">
                                Practice Mode
                            </span>
                        </div>
                        <h2 className="text-sm font-bold text-[var(--color-text)] mt-1">
                            Question {currentIndex + 1} of {questions.length}
                        </h2>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleAskAiTutor}
                            className="px-2.5 sm:px-3 py-1.5 rounded-xl border border-[var(--color-primary-20)] bg-[var(--color-primary-5)] hover:bg-[var(--color-primary-10)] text-[var(--color-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Ask AI Tutor for guidance"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Ask AI Tutor</span>
                        </button>
                        <button
                            onClick={toggleBookmark}
                            className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
                                bookmarked[currentQ.id]
                                    ? 'bg-[var(--color-accent-20)] border-[var(--color-accent)] text-[var(--color-accent)]'
                                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]'
                            }`}
                            title="Bookmark question"
                        >
                            <svg className="w-5 h-5" fill={bookmarked[currentQ.id] ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 sm:p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-xl hover:bg-[var(--color-border)]/50 transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Close modal (Esc)"
                            aria-label="Close practice modal"
                        >
                            <span className="hidden sm:inline-block text-[10px] text-[var(--color-muted)] font-mono border border-[var(--color-border)] px-1.5 py-0.5 rounded-md bg-[var(--color-surface)]">
                                Esc
                            </span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Question Body */}
                <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
                    {/* Topic Badge */}
                    {currentQ.topic?.name && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-primary-5)] border border-[var(--color-border)] text-[var(--color-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
                            Topic: <strong className="text-[var(--color-text)]">{currentQ.topic.name}</strong>
                        </div>
                    )}

                    {/* Comprehension Passage */}
                    {currentQ.passage_text && (
                        <div className="p-4 md:p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm leading-relaxed text-[var(--color-text)] italic chat-markdown">
                            <p className="not-italic text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider mb-2">
                                Reading Comprehension Passage:
                            </p>
                            <RichText text={formatMathText(currentQ.passage_text)} />
                        </div>
                    )}

                    {/* Prescribed Literature / Book Context Banner (If passage is absent) */}
                    {!currentQ.passage_text && extractLiteratureContext(currentQ.explanation) && (
                        <div className="p-4 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] flex items-start sm:items-center gap-3.5 shadow-xs">
                            <span className="p-2 rounded-xl bg-[var(--color-primary)] text-[var(--color-accent)] shrink-0 shadow-xs">
                                <BookOpen className="w-4 h-4 text-[var(--color-accent)]" />
                            </span>
                            <div className="space-y-0.5">
                                <div className="font-extrabold uppercase text-[10px] tracking-wider text-[var(--color-primary)]">
                                    Prescribed Literature Text / Novel
                                </div>
                                <div className="text-xs font-bold text-[var(--color-text)]">
                                    Based on: <span className="text-[var(--color-primary)] font-black">{extractLiteratureContext(currentQ.explanation)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Diagram / Image */}
                    {currentQ.image_url && (
                        <div className="flex justify-center my-4">
                            <img
                                src={currentQ.image_url}
                                alt="Question diagram"
                                className="max-h-64 rounded-2xl border border-[var(--color-border)] shadow-sm object-contain"
                            />
                        </div>
                    )}

                    {/* Question Text with KaTeX LaTeX Rendering */}
                    <div className="text-lg md:text-xl font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                        <RichText text={formatMathText(currentQ.question_text)} />
                    </div>

                    {/* Options List */}
                    <div className="space-y-3 pt-2">
                        {currentQ.options.map((option, idx) => {
                            const isSelected = selectedOptId === option.id;
                            const isOptionCorrect = option.id === correctOptionId || Boolean(option.is_correct);
                            
                            let optionStyle = 'border-[var(--color-border)] bg-[var(--color-background)]/40 hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary-light)]';
                            let badgeStyle = 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]';

                            if (isAnswered && verification?.unverified) {
                                // Not checked yet (offline): just show which option was picked.
                                optionStyle = isSelected
                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-5)] ring-2 ring-[var(--color-primary)]/30'
                                    : 'border-[var(--color-border)] opacity-60 bg-[var(--color-background)]/20';
                            } else if (isAnswered) {
                                if (isOptionCorrect) {
                                    optionStyle = 'border-[var(--color-success)] bg-[var(--color-success-10)] text-[var(--color-success)] ring-2 ring-[var(--color-success)]/30';
                                    badgeStyle = 'bg-[var(--color-success)] text-white font-bold border-transparent';
                                } else if (isSelected && !isOptionCorrect) {
                                    optionStyle = 'border-[var(--color-error)] bg-[var(--color-error-10)] text-[var(--color-error)] ring-2 ring-[var(--color-error)]/30';
                                    badgeStyle = 'bg-[var(--color-error)] text-white font-bold border-transparent';
                                } else {
                                    optionStyle = 'border-[var(--color-border)] opacity-60 bg-[var(--color-background)]/20';
                                }
                            }

                            return (
                                <button
                                    key={option.id || idx}
                                    disabled={isAnswered}
                                    onClick={() => handleSelectOption(option.id)}
                                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-4 ${optionStyle} cursor-pointer disabled:cursor-default`}
                                >
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold transition-colors ${badgeStyle}`}>
                                            {option.label || chrFromIdx(idx)}
                                        </span>
                                        {!isAnswered && (
                                            <span className="hidden lg:inline-flex text-[9px] font-mono px-1 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)] font-bold">
                                                [{option.label || chrFromIdx(idx)}]
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 pt-1 font-semibold text-sm text-[var(--color-text)] [&_p]:inline">
                                        <RichText text={formatMathText(option.option_text)} />
                                    </div>
                                    {isAnswered && isOptionCorrect && (
                                        <svg className="w-6 h-6 text-[var(--color-success)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                    {isAnswered && isSelected && !isOptionCorrect && (
                                        <svg className="w-6 h-6 text-[var(--color-error)] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {isAnswered && verification?.unverified && (
                        <div className="p-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-sm text-[var(--color-text)] animate-fade-in">
                            <p className="font-bold">Answer recorded</p>
                            <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
                                You're offline, and answers are checked by the server, so this one can't be marked right now. Reconnect to see the correct answer and working.
                            </p>
                        </div>
                    )}

                    {/* Instant Explanation & Solution Card */}
                    {isAnswered && !verification?.unverified && (
                        <div className={`p-5 md:p-6 rounded-2xl border transition-all animate-fade-in ${
                            isCorrect
                                ? 'bg-[var(--color-success-5)] border-[var(--color-success)]/30 space-y-3'
                                : 'bg-[var(--color-error-5)] border-[var(--color-error)]/30 space-y-4'
                        }`}>
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                                        isCorrect
                                            ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]'
                                            : 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error-20)]'
                                    }`}>
                                        {isCorrect ? '✓ Correct Answer' : '✗ Incorrect'}
                                    </span>
                                    <span className={`text-xs font-bold ${isCorrect ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                        {isCorrect ? 'Outstanding! You mastered this concept.' : 'Identify the misconception before moving forward.'}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAskAiTutor}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer ${
                                        isCorrect
                                            ? 'bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-[var(--color-primary)]'
                                            : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white'
                                    }`}
                                >
                                    {isCorrect ? <Sparkles className="w-3.5 h-3.5" /> : <Lightbulb className="w-3.5 h-3.5" />}
                                    <span>{isCorrect ? 'Deep Dive Working' : 'Why am I wrong?'}</span>
                                </button>
                            </div>

                            {/* Mistake Comparison Cards (when incorrect) */}
                            {!isCorrect && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                    <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-error)]/30 space-y-1">
                                        <span className="text-[10px] font-bold text-[var(--color-error)] uppercase tracking-wider block">
                                            Your Answer
                                        </span>
                                        <div className="text-xs font-semibold text-[var(--color-text)] [&_p]:inline">
                                            <RichText text={selectedOpt ? formatMathText(`${selectedOpt.label || ''} ${selectedOpt.option_text}`) : 'None'} />
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-success)]/30 space-y-1">
                                        <span className="text-[10px] font-bold text-[var(--color-success)] uppercase tracking-wider block">
                                            Correct Answer
                                        </span>
                                        <div className="text-xs font-semibold text-[var(--color-text)] [&_p]:inline">
                                            <RichText text={correctOpt ? formatMathText(`${correctOpt.label || ''} ${correctOpt.option_text}`) : 'None'} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Official Solution */}
                            {currentQ.explanation ? (
                                <div className="p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] leading-relaxed chat-markdown">
                                    <strong className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                                        Step-by-Step Solution & Working:
                                    </strong>
                                    <RichText text={formatMathText(currentQ.explanation)} />
                                </div>
                            ) : !isCorrect && (
                                <p className="text-xs text-[var(--color-muted)]">
                                    Correct option is <strong>{correctOpt?.label || 'A'}</strong>. Click <em>"Why am I wrong?"</em> for full 4-step diagnostic breakdown.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Navigation Bar */}
                <div className="p-4 md:px-8 md:py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between">
                    <button
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                        className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1.5"
                        title="Previous question (Press P or Left Arrow)"
                    >
                        <span>← Previous</span>
                        <span className="hidden sm:inline text-[10px] font-mono opacity-60">(P)</span>
                    </button>

                    <div className="text-xs font-semibold text-[var(--color-muted)]">
                        {currentIndex + 1} / {questions.length} Questions
                    </div>

                    <button
                        disabled={currentIndex === questions.length - 1}
                        onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                        className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                        title="Next question (Press N or Right Arrow)"
                    >
                        <span>Next →</span>
                        <span className="hidden sm:inline text-[10px] font-mono opacity-80">(N)</span>
                    </button>
                </div>
            </div>
        </div>

        {/* AI Tutor Insights Drawer (Overlays on top with z-[60]) */}
        <AiExplanationDrawer
            isOpen={aiTutorOpen}
            onClose={() => setAiTutorOpen(false)}
            questionText={currentQ.question_text}
            content={aiTutorContent}
            loading={aiTutorLoading}
            selectedOptionText={selectedOpt ? (selectedOpt.label ? `${selectedOpt.label}. ${selectedOpt.option_text}` : selectedOpt.option_text) : null}
            correctOptionText={correctOpt ? (correctOpt.label ? `${correctOpt.label}. ${correctOpt.option_text}` : correctOpt.option_text) : null}
            questionId={currentQ.id}
            topicId={currentQ.topic?.id}
            subjectId={currentQ.subject?.id}
            examCode={currentQ.exam_code}
            isPastQuestion={true}
        />
    </>
    );
};

function chrFromIdx(index: number): string {
    return String.fromCharCode(65 + index);
}
