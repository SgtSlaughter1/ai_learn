import React, { useState, useRef } from 'react';
import { RichText } from '@/components/common/RichText';
import { PassageView } from '@/components/quiz/PassageView';
import { createPortal } from 'react-dom';
import 'katex/dist/katex.min.css';
import {
    RevisionQueueItem,
    RevisionSubmitResult,
    RevisionSessionCompleteResult,
} from '../../types/revision';
import { enqueue, getSyncUser } from '../../services/SyncQueue';
import { sendOrQueue, syncAll } from '../../services/SyncService';
import { formatMathText, extractLiteratureContext } from '../../utils/mathFormatter';
import { reviewAnswer } from '../../services/AnswerKey';
import { AiExplanationDrawer } from '../quiz/AiExplanationDrawer';
import {
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Zap,
    BookOpen,
    ArrowRight,
    Trophy,
    Flame,
    X,
    Lightbulb,
    Clock,
} from 'lucide-react';

interface Props {
    items: RevisionQueueItem[];
    onClose: () => void;
    onSessionCompleted?: (result: RevisionSessionCompleteResult) => void;
}

export const DailyRevisionModal: React.FC<Props> = ({ items, onClose, onSessionCompleted }) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
    const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
    const [submitResult, setSubmitResult] = useState<RevisionSubmitResult | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [userRating, setUserRating] = useState<'again' | 'hard' | 'good' | 'easy' | null>(null);

    // Session Stats tracking
    const [correctCount, setCorrectCount] = useState<number>(0);
    const [isSessionFinished, setIsSessionFinished] = useState<boolean>(false);
    const [completionResult, setCompletionResult] = useState<RevisionSessionCompleteResult | null>(null);

    // AI Mistake Explanation Drawer
    const [aiTutorOpen, setAiTutorOpen] = useState<boolean>(false);
    const [aiTutorContent, setAiTutorContent] = useState<string | null>(null);
    const [aiTutorLoading, setAiTutorLoading] = useState<boolean>(false);
    const explanationCacheRef = useRef<Record<string, string>>({});

    const currentItem = items[currentIndex];
    const totalItems = items.length;

    if (!currentItem && !isSessionFinished) {
        return null;
    }

    const selectedOpt = currentItem?.options.find((o) => o.id === selectedOptionId);
    const correctOpt = currentItem?.options.find((o) => o.is_correct) ||
        (submitResult?.correct_option_id ? currentItem?.options.find((o) => o.id === submitResult.correct_option_id) : undefined);

    // One review per question, sent once with the learner's final rating when they move on.
    // (Previously the answer and any rating change were each sent, applying the spaced
    // repetition update and its XP twice; and nothing was saved offline.)
    const pendingReviewRef = useRef<{
        item_id: number;
        selected_option_id: number;
        rating: 'again' | 'hard' | 'good' | 'easy';
        reviewed_at: string;
    } | null>(null);

    const flushReview = async () => {
        const review = pendingReviewRef.current;
        pendingReviewRef.current = null;
        if (!review || !getSyncUser()) return;
        await enqueue({
            table_name: 'revisionReviews',
            action: 'insert',
            record_id: `rev_${review.item_id}_${crypto.randomUUID()}`,
            endpoint: '/api/v1/revision/submit',
            method: 'POST',
            payload: review,
        }).catch((e) => console.warn('Could not save revision review:', e));
        if (navigator.onLine) void syncAll();
    };

    // Shown straight away, online or offline; the server applies the same rules when the review syncs.
    const localReviewResult = (
        isCorrect: boolean,
        rating: 'again' | 'hard' | 'good' | 'easy',
        correctOptionId: number | undefined,
        explanation: string | undefined,
    ): RevisionSubmitResult => {
        const recalled = isCorrect && rating !== 'again';
        const interval = recalled ? Math.max(3, currentItem.interval_days * 2) : 1;
        return {
            success: true,
            is_correct: isCorrect,
            correct_option_id: correctOptionId,
            explanation,
            new_interval_days: interval,
            next_review_in: interval === 1 ? 'Tomorrow' : `${interval} days`,
            is_mastered: false,
            xp_earned: recalled ? ({ easy: 6, good: 4, hard: 2, again: 0 } as const)[rating] : 0,
        };
    };

    const handleSelectOption = async (optionId: number) => {
        if (isSubmitted || isSubmitting) return;
        setIsSubmitting(true);

        setSelectedOptionId(optionId);
        // Marked on the device from the answer hash (offline too): right/wrong, the correct
        // option and the unlocked explanation. The server re-checks the choice on sync.
        const scope = currentItem.item_type === 'past_question' ? 'pq' : 'q';
        const questionId = (currentItem.item_type === 'past_question' ? currentItem.past_question_id : currentItem.question_id) ?? 0;
        const review = currentItem.answer_hash
            ? await reviewAnswer(scope, { id: questionId, answer_hash: currentItem.answer_hash, explanation_sealed: currentItem.explanation_sealed, options: currentItem.options }, optionId)
            : null;
        const correctOptionId = review?.correctOptionId ?? currentItem.options.find((o) => o.is_correct)?.id;
        const isCorr = correctOptionId !== undefined && correctOptionId === optionId;
        const explanation = review?.explanation ?? currentItem.explanation ?? undefined;
        const rating = isCorr ? 'good' : 'again';

        pendingReviewRef.current = {
            item_id: currentItem.id,
            selected_option_id: optionId,
            rating,
            reviewed_at: new Date().toISOString(),
        };
        setSubmitResult(localReviewResult(isCorr, rating, correctOptionId, explanation));
        setUserRating(rating);
        setIsSubmitted(true);
        setIsSubmitting(false);
        if (isCorr) setCorrectCount((prev) => prev + 1);
    };

    const handleUpdateRating = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
        setUserRating(rating);
        if (pendingReviewRef.current) {
            pendingReviewRef.current = { ...pendingReviewRef.current, rating };
        }
        setSubmitResult(localReviewResult(Boolean(submitResult?.is_correct), rating, submitResult?.correct_option_id, submitResult?.explanation));
    };

    const handleClose = () => {
        void flushReview();
        onClose();
    };

    const handleExplainMistake = async () => {
        if (!currentItem) return;
        setAiTutorOpen(true);

        const cacheKey = `${currentItem.item_type}_${currentItem.id}_${selectedOptionId}`;
        if (explanationCacheRef.current[cacheKey]) {
            setAiTutorContent(explanationCacheRef.current[cacheKey]);
            setAiTutorLoading(false);
            return;
        }

        setAiTutorLoading(true);
        setAiTutorContent(null);

        try {
            const endpoint = currentItem.item_type === 'past_question'
                ? '/api/v1/past-questions/explain'
                : '/api/v1/questions/explain';

            const payload = currentItem.item_type === 'past_question'
                ? { past_question_id: currentItem.past_question_id, selected_option_id: selectedOptionId }
                : { question_id: currentItem.question_id, selected_option_id: selectedOptionId };

            const csrfToken = document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] || '';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': decodeURIComponent(csrfToken),
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (data.success && data.explanation) {
                explanationCacheRef.current[cacheKey] = data.explanation;
                setAiTutorContent(data.explanation);
            } else {
                setAiTutorContent(submitResult?.explanation || 'Review the core concept to resolve this misconception.');
            }
        } catch {
            setAiTutorContent(submitResult?.explanation || 'Review the core concept to resolve this misconception.');
        } finally {
            setAiTutorLoading(false);
        }
    };

    const handleNextQuestion = async () => {
        await flushReview();

        if (currentIndex + 1 < totalItems) {
            setCurrentIndex((prev) => prev + 1);
            setSelectedOptionId(null);
            setIsSubmitted(false);
            setSubmitResult(null);
            setUserRating(null);
            return;
        }

        // Finalize session
        setIsSubmitting(true);
        // Same formula as the server (processRevisionCompletion): 1 XP per correct answer, +3 for a perfect session.
        const estimate: RevisionSessionCompleteResult = {
            bonus_xp: correctCount > 0 ? correctCount + (correctCount === totalItems ? 3 : 0) : 0,
            completed_count: totalItems,
            correct_count: correctCount,
            streak_maintained: true,
        };

        try {
            const result = getSyncUser()
                ? await sendOrQueue<{ success: boolean; data: RevisionSessionCompleteResult }>({
                    table_name: 'revisionSessions',
                    endpoint: '/api/v1/revision/complete-session',
                    method: 'POST',
                    payload: {
                        completed_count: totalItems,
                        correct_count: correctCount,
                        completed_at: new Date().toISOString(),
                    },
                })
                : null;
            const final = result?.status === 'sent' && result.data?.data ? result.data.data : estimate;
            setCompletionResult(final);
            onSessionCompleted?.(final);
        } catch {
            setCompletionResult(estimate);
            onSessionCompleted?.(estimate);
        } finally {
            setIsSubmitting(false);
            setIsSessionFinished(true);
        }
    };

    const litContext = currentItem ? extractLiteratureContext(currentItem.explanation || submitResult?.explanation || '') : null;
    const earnedBonusXp = completionResult?.bonus_xp !== undefined ? completionResult.bonus_xp : correctCount;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Modal Top Header */}
                <div className="p-3.5 sm:p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-start sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-[var(--color-accent)] text-white flex items-center justify-center shadow-xs shrink-0">
                            <Zap className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-accent)]">
                                    Today's 5-Minute AI Revision
                                </span>
                                <span className="text-xs text-[var(--color-muted)] hidden sm:inline">•</span>
                                <span className="text-[10px] font-bold text-[var(--color-muted)]">
                                    Q{currentIndex + 1} of {totalItems}
                                </span>
                            </div>
                            <h2 className="text-xs sm:text-sm font-bold text-[var(--color-text)] truncate">
                                {currentItem?.subject_name} • <span className="text-[var(--color-muted)]">{currentItem?.topic_name}</span>
                            </h2>
                        </div>
                    </div>

                    <button
                        onClick={handleClose}
                        aria-label="Close revision session"
                        className="p-1.5 sm:p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-xl hover:bg-[var(--color-border)]/50 transition-colors cursor-pointer shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Bar Line */}
                <div className="w-full bg-[var(--color-border)] h-1.5 overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-primary)] transition-all duration-300"
                        style={{ width: `${((currentIndex + (isSubmitted ? 1 : 0)) / totalItems) * 100}%` }}
                    />
                </div>

                {/* Main Content Area */}
                {!isSessionFinished ? (
                    <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-5">
                        {/* Purpose / Why This Question Badge */}
                        {currentItem?.badge && (
                            <div className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                                currentItem.badge.color === 'error'
                                    ? 'bg-[var(--color-error-5)] border-[var(--color-error)]/25 text-[var(--color-error)]'
                                    : currentItem.badge.color === 'accent'
                                    ? 'bg-[var(--color-accent-5)] border-[var(--color-accent-20)] text-[var(--color-accent)]'
                                    : currentItem.badge.color === 'success'
                                    ? 'bg-[var(--color-success-5)] border-[var(--color-success)]/25 text-[var(--color-success)]'
                                    : 'bg-[var(--color-primary-5)] border-[var(--color-primary-20)] text-[var(--color-primary)]'
                            }`}>
                                <div className="flex items-center gap-2">
                                    {currentItem.badge.color === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
                                    {currentItem.badge.color === 'accent' && <Zap className="w-4 h-4 shrink-0" />}
                                    {currentItem.badge.color === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                                    {currentItem.badge.color === 'primary' && <BookOpen className="w-4 h-4 shrink-0" />}
                                    <div>
                                        <span className="font-extrabold uppercase text-[10px] tracking-wider block">
                                            {currentItem.badge.label}
                                        </span>
                                        <span className="text-[11px] font-medium text-[var(--color-text)]">
                                            {currentItem.badge.description}
                                        </span>
                                    </div>
                                </div>

                                {currentItem.exam_code && (
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] shrink-0">
                                        {currentItem.exam_code} {currentItem.exam_year || ''}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Passage (if any) */}
                        {currentItem?.passage_text && (
                            <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs leading-relaxed text-[var(--color-text)] italic chat-markdown">
                                <span className="not-italic text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider block mb-1">
                                    Passage Context:
                                </span>
                                <RichText text={formatMathText(currentItem.passage_text)} />
                            </div>
                        )}

                        {/* Shared passage of a school question (poem, diagram, table) */}
                        {currentItem?.context && (
                            <details open className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                                <summary className="text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider cursor-pointer">
                                    {currentItem.context.title || 'Passage'}
                                </summary>
                                <div className="pt-2 max-h-64 overflow-y-auto">
                                    <PassageView context={currentItem.context} compact />
                                </div>
                            </details>
                        )}

                        {/* Prescribed Literature Context */}
                        {!currentItem?.passage_text && !currentItem?.context && litContext && (
                            <div className="p-3 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] flex items-center gap-2.5 text-xs">
                                <BookOpen className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                                <span className="text-[var(--color-text)] font-semibold">
                                    Based on prescribed text: <strong className="text-[var(--color-primary)]">{litContext}</strong>
                                </span>
                            </div>
                        )}

                        {/* Question Text */}
                        <div className="text-base font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                            <RichText text={formatMathText(currentItem?.question_text || '')} />
                        </div>

                        {/* Question Image (if any) */}
                        {currentItem?.image_url && (
                            <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] max-w-md mx-auto">
                                <img src={currentItem.image_url} alt="Question context" className="w-full object-contain max-h-64" />
                            </div>
                        )}

                        {/* Option Choices */}
                        <div className="space-y-2.5 pt-1">
                            {currentItem?.options.map((opt, idx) => {
                                const isSelected = selectedOptionId === opt.id;
                                const isCorrectChoice = opt.is_correct || (submitResult && submitResult.correct_option_id === opt.id);

                                let optStyle = 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary-light)] hover:bg-[var(--color-surface-hover)]';

                                if (isSubmitted) {
                                    if (isCorrectChoice) {
                                        optStyle = 'border-[var(--color-success)] bg-[var(--color-success-10)] text-[var(--color-success)] font-bold';
                                    } else if (isSelected && !isCorrectChoice) {
                                        optStyle = 'border-[var(--color-error)] bg-[var(--color-error-10)] text-[var(--color-error)] font-bold';
                                    } else {
                                        optStyle = 'border-[var(--color-border)]/60 bg-[var(--color-surface)] opacity-50';
                                    }
                                } else if (isSelected) {
                                    optStyle = 'border-[var(--color-primary)] bg-[var(--color-primary-5)] ring-2 ring-[var(--color-primary-20)] font-bold';
                                }

                                return (
                                    <button
                                        key={opt.id || idx}
                                        type="button"
                                        disabled={isSubmitted || isSubmitting}
                                        onClick={() => handleSelectOption(opt.id)}
                                        className={`w-full p-4 rounded-2xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer disabled:cursor-default ${optStyle}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center font-black uppercase text-[11px]">
                                                {opt.label}
                                            </span>
                                            <span className="font-medium text-[var(--color-text)] [&_p]:inline">
                                                <RichText text={formatMathText(opt.option_text)} />
                                            </span>
                                        </div>

                                        {isSubmitted && isCorrectChoice && (
                                             <span className="text-[10px] font-extrabold uppercase text-[var(--color-success)] flex items-center gap-1">
                                                 <CheckCircle2 className="w-4 h-4" /> Correct
                                             </span>
                                        )}
                                        {isSubmitted && isSelected && !isCorrectChoice && (
                                             <span className="text-[10px] font-extrabold uppercase text-[var(--color-error)] flex items-center gap-1">
                                                 <AlertCircle className="w-4 h-4" /> Your choice
                                             </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Post-Answer Feedback & Mistake Diagnostic Drawer Trigger */}
                        {isSubmitted && (
                            <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-3 animate-scale-in">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        {submitResult?.is_correct ? (
                                            <div className="w-6 h-6 rounded-full bg-[var(--color-success)] text-white flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-[var(--color-error)] text-white flex items-center justify-center">
                                                <AlertCircle className="w-4 h-4" />
                                            </div>
                                        )}
                                        <span className="font-bold text-xs text-[var(--color-text)]">
                                            {submitResult?.is_correct
                                                ? `Great recall (+${submitResult.xp_earned || 3} XP)! Next review in ${submitResult.next_review_in || '7 days'}`
                                                : 'Misconception identified (+0 XP). Scheduled for review tomorrow.'}
                                        </span>
                                    </div>

                                    {!submitResult?.is_correct && (
                                        <button
                                            type="button"
                                            onClick={handleExplainMistake}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                                        >
                                            <Lightbulb className="w-3.5 h-3.5" />
                                            <span>Why am I wrong?</span>
                                        </button>
                                    )}
                                </div>

                                {/* Metacognitive Calibration Bar */}
                                <div className="pt-2 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[10px] font-extrabold uppercase text-[var(--color-muted)] tracking-wider">
                                        Recall Confidence:
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRating('again')}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                                userRating === 'again'
                                                    ? 'bg-[var(--color-error)] text-white border-transparent'
                                                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                            }`}
                                        >
                                            Again (1d)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRating('hard')}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                                userRating === 'hard'
                                                    ? 'bg-[var(--color-accent)] text-white border-transparent'
                                                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                            }`}
                                        >
                                            Hard (3d)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRating('good')}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                                userRating === 'good'
                                                    ? 'bg-[var(--color-primary)] text-white border-transparent'
                                                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                            }`}
                                        >
                                            Good (7d)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateRating('easy')}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                                userRating === 'easy'
                                                    ? 'bg-[var(--color-success)] text-white border-transparent'
                                                    : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                            }`}
                                        >
                                            Easy (14d)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Session Completed Celebration Screen */
                    <div className="p-8 sm:p-10 text-center space-y-6 flex-1 flex flex-col items-center justify-center animate-fade-in">
                        <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg border animate-bounce ${
                            correctCount > 0
                                ? 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent-20)]'
                                : 'bg-[var(--color-primary-5)] text-[var(--color-primary)] border-[var(--color-primary-20)]'
                        }`}>
                            {correctCount > 0 ? <Trophy className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
                        </div>

                        <div className="space-y-2 max-w-md">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border ${
                                correctCount === totalItems
                                    ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]'
                                    : correctCount > 0
                                    ? 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent-20)]'
                                    : 'bg-[var(--color-primary-5)] text-[var(--color-primary)] border-[var(--color-primary-20)]'
                            }`}>
                                <Sparkles className="w-3.5 h-3.5" />
                                {correctCount === totalItems
                                    ? '🌟 Perfect Recall Completed'
                                    : correctCount > 0
                                    ? 'Daily Retention Updated'
                                    : 'Session Completed • Review Scheduled'}
                            </div>
                            <h3 className="text-2xl font-extrabold text-[var(--color-text)]">
                                {correctCount === totalItems
                                    ? "Flawless Recall Today! 🎉"
                                    : correctCount > 0
                                    ? "Great Effort Today!"
                                    : "Misconceptions Logged for Review"}
                            </h3>
                            <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                {correctCount === totalItems
                                    ? "You scored 100% on today's revision queue. All concepts have graduated to longer retention intervals."
                                    : correctCount > 0
                                    ? `You successfully reinforced ${correctCount} of ${totalItems} concepts. Missed questions have been rescheduled for tomorrow.`
                                    : "You've reviewed all 6 items. Missed questions are queued for targeted practice tomorrow so you can master them."}
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
                            <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                <span className={`block text-xl font-black ${earnedBonusXp > 0 ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}>
                                    +{earnedBonusXp}
                                </span>
                                <span className="text-[10px] font-extrabold uppercase text-[var(--color-muted)]">
                                    {earnedBonusXp > 0 ? 'Bonus XP' : '0 Passed'}
                                </span>
                            </div>
                            <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                <span className={`block text-xl font-black ${correctCount > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                                    {correctCount}/{totalItems}
                                </span>
                                <span className="text-[10px] font-extrabold uppercase text-[var(--color-muted)]">
                                    Accuracy
                                </span>
                            </div>
                            <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                <div className="flex items-center justify-center gap-1 text-[var(--color-error)]">
                                    <Flame className="w-5 h-5 fill-current" />
                                    <span className="text-xl font-black">Active</span>
                                </div>
                                <span className="text-[10px] font-extrabold uppercase text-[var(--color-muted)]">
                                    Streak Kept
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Controls */}
                <div className="p-3.5 sm:p-4 sm:px-7 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {!isSessionFinished ? (
                        <>
                            <span className="text-[11px] font-medium text-[var(--color-muted)] flex items-center justify-center sm:justify-start gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                ~{Math.max(1, Math.round((totalItems - currentIndex) * 0.8))} min remaining
                            </span>

                            <button
                                type="button"
                                disabled={!isSubmitted || isSubmitting}
                                onClick={handleNextQuestion}
                                className="w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <span>{currentIndex + 1 === totalItems ? 'Finish Revision' : 'Next Question'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-full py-3 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer text-center"
                        >
                            Return to Dashboard
                        </button>
                    )}
                </div>
            </div>

            {/* AI Mistake Diagnostic Drawer */}
            <AiExplanationDrawer
                isOpen={aiTutorOpen}
                onClose={() => setAiTutorOpen(false)}
                questionText={currentItem?.question_text}
                content={aiTutorContent}
                loading={aiTutorLoading}
                selectedOptionText={selectedOpt ? (selectedOpt.label ? `${selectedOpt.label}. ${selectedOpt.option_text}` : selectedOpt.option_text) : null}
                correctOptionText={correctOpt ? (correctOpt.label ? `${correctOpt.label}. ${correctOpt.option_text}` : correctOpt.option_text) : null}
                questionId={currentItem?.question_id || currentItem?.past_question_id || null}
                isPastQuestion={currentItem?.item_type === 'past_question'}
                examCode={currentItem?.exam_code}
            />
        </div>,
        document.body
    );
};
