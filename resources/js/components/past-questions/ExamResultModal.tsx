import React, { useState } from 'react';
import { RichText } from '@/components/common/RichText';
import 'katex/dist/katex.min.css';
import { usePage } from '@inertiajs/react';
import { ExamSimulationResult } from '../../types/past-questions';
import { formatMathText, extractLiteratureContext } from '../../utils/mathFormatter';
import { BookOpen, CheckCircle2 } from 'lucide-react';

interface Props {
    result: ExamSimulationResult;
    onClose: () => void;
    onRetake: () => void;
}

export const ExamResultModal: React.FC<Props> = ({ result, onClose, onRetake }) => {
    const [activeTab, setActiveTab] = useState<'summary' | 'topics' | 'review'>('summary');
    const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

    const pageProps = usePage()?.props as any;
    const user = pageProps?.auth?.user;
    const isGuest = !user;

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}m ${s}s`;
    };

    const score = result.score_percentage || 0;
    const scoringPending = Boolean(result.scoring_pending);
    const isPass = score >= 50;
    const isExcellence = score >= 75;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-md p-3 md:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl sm:rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between gap-3">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-primary)]">
                            Exam Simulation Scorecard
                        </span>
                        <h2 className="text-lg sm:text-xl font-extrabold text-[var(--color-text)] mt-0.5">
                            {result.exam_code?.toUpperCase()} Performance Report
                        </h2>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 sm:p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-xl hover:bg-[var(--color-border)]/50 transition-colors cursor-pointer shrink-0"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className={`flex border-b border-[var(--color-border)] px-4 sm:px-6 bg-[var(--color-surface)] overflow-x-auto no-scrollbar whitespace-nowrap ${scoringPending ? 'hidden' : ''}`}>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`py-3.5 px-3 sm:px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
                            activeTab === 'summary'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Overview & Score
                    </button>
                    <button
                        onClick={() => setActiveTab('topics')}
                        className={`py-3.5 px-3 sm:px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                            activeTab === 'topics'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Topic Breakdown
                        {result.weak_topics?.length > 0 && (
                            <span className="w-2 h-2 rounded-full bg-[var(--color-error)]"></span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('review')}
                        className={`py-3.5 px-3 sm:px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
                            activeTab === 'review'
                                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                : 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                    >
                        Review Answers ({result.detailed_results?.length || 0})
                    </button>
                </div>

                {/* Tab Body */}
                <div className="p-4 sm:p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
                    {scoringPending && (
                        <div className="p-8 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] text-center space-y-3">
                            <div className="inline-block px-3.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-xs bg-[var(--color-surface)] border border-[var(--color-border)]">
                                Saved offline
                            </div>
                            <p className="text-2xl font-extrabold text-[var(--color-text)]">Your answers are saved</p>
                            <p className="text-sm text-[var(--color-muted)] max-w-md mx-auto leading-relaxed">
                                You answered {result.answered_count ?? 0} of {result.total_questions} questions in {formatTime(result.time_spent_seconds)}.
                                Your score and topic breakdown will be worked out when you're back online, and will appear in your exam history.
                            </p>
                        </div>
                    )}
                    {result.provisional && (
                        <p className="px-4 py-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs font-semibold text-amber-700 dark:text-amber-300">
                            Marked on this device while offline. Your official score is confirmed automatically when you're back online.
                        </p>
                    )}
                    {!scoringPending && activeTab === 'summary' && (
                        <div className="space-y-6">
                            {/* Score Card Hero */}
                            <div className={`p-8 rounded-3xl border text-center relative overflow-hidden ${
                                isExcellence
                                    ? 'bg-[var(--color-success-5)] border-[var(--color-success)]/30'
                                    : isPass
                                    ? 'bg-[var(--color-primary-5)] border-[var(--color-primary)]/30'
                                    : 'bg-[var(--color-error-5)] border-[var(--color-error)]/30'
                            }`}>
                                <div className="inline-block px-3.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-2 shadow-xs bg-[var(--color-surface)] border border-[var(--color-border)]">
                                    {isExcellence ? 'Outstanding Mastery' : isPass ? 'Passed - Good Attempt' : 'Good Effort - Keep Practicing'}
                                </div>
                                <div className="text-6xl md:text-7xl font-extrabold text-[var(--color-text)] my-2">
                                    {score}%
                                </div>
                                <p className="text-xs font-semibold text-[var(--color-muted)]">
                                    {result.correct_answers} correct out of {result.total_questions} questions ({result.wrong_answers} wrong)
                                </p>
                            </div>

                            {/* Stat Boxes */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                    <span className="block text-2xl font-black text-[var(--color-success)]">{result.correct_answers}</span>
                                    <span className="text-xs font-semibold text-[var(--color-muted)]">Correct Answers</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                    <span className="block text-2xl font-black text-[var(--color-error)]">{result.wrong_answers}</span>
                                    <span className="text-xs font-semibold text-[var(--color-muted)]">Incorrect Answers</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                    <span className="block text-2xl font-black text-[var(--color-primary)]">{formatTime(result.time_spent_seconds)}</span>
                                    <span className="text-xs font-semibold text-[var(--color-muted)]">Time Spent</span>
                                </div>
                                <div className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-center">
                                    <span className="block text-2xl font-black text-[var(--color-accent)]">{result.topic_breakdown?.length || 0}</span>
                                    <span className="text-xs font-semibold text-[var(--color-muted)]">Topics Tested</span>
                                </div>
                            </div>

                            {/* Key Focus Areas Alert */}
                            {result.weak_topics?.length > 0 && (
                                <div className="p-5 rounded-2xl bg-[var(--color-accent-10)] border border-[var(--color-accent-20)]">
                                    <div className="flex items-center gap-2 text-[var(--color-accent)] font-bold text-xs uppercase tracking-wider mb-2">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        Topics Recommended for Practice:
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {result.weak_topics.map((t, i) => (
                                            <span
                                                key={i}
                                                className="px-3 py-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text)]"
                                            >
                                                {t.topic_name} ({t.accuracy}%)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Scorecard Persistence Callout / Status */}
                            {isGuest ? (
                                <div className="p-5 rounded-2xl bg-gradient-to-r from-[var(--color-primary-10)] to-[var(--color-accent-10)] border border-[var(--color-primary-20)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-xs text-[var(--color-text)] flex items-center gap-1.5">
                                            <span>📊</span>
                                            <span>Save Your CBT Simulation Scorecard</span>
                                        </h4>
                                        <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                                            Sign in to permanently save your exam score history, track progress across curriculum topics, and unlock unlimited questions.
                                        </p>
                                    </div>
                                    <a
                                        href="/login"
                                        className="px-4 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-bold text-xs shrink-0 text-center transition-all shadow-xs"
                                    >
                                        Sign In / Register →
                                    </a>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl bg-[var(--color-success-10)] border border-[var(--color-success-20)] flex items-center gap-3.5">
                                    <div className="w-8 h-8 rounded-xl bg-[var(--color-success)] flex items-center justify-center text-white shrink-0 shadow-xs">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xs text-[var(--color-success)]">
                                            Scorecard Saved to Your Learner Profile
                                        </h4>
                                        <p className="text-xs text-[var(--color-muted)]">
                                            Your mock score, topic breakdown, and XP have been recorded to your account history.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!scoringPending && activeTab === 'topics' && (
                        <div className="space-y-4">
                            <p className="text-[10px] text-[var(--color-muted)] uppercase tracking-wider font-extrabold">
                                Curriculum Topic Mastery Breakdown:
                            </p>
                            <div className="space-y-3">
                                {result.topic_breakdown?.map((topic, idx) => {
                                    let badgeColor = 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]';
                                    if (topic.status === 'moderate') badgeColor = 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent-20)]';
                                    if (topic.status === 'weak') badgeColor = 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error-20)]';

                                    const displayStatus = topic.status === 'weak' ? 'Needs Practice' : topic.status === 'moderate' ? 'Review' : 'Mastered';

                                    return (
                                        <div
                                            key={idx}
                                            className="p-4 rounded-2xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex flex-col md:flex-row md:items-center justify-between gap-3"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-sm text-[var(--color-text)]">
                                                        {topic.topic_name}
                                                    </span>
                                                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border ${badgeColor}`}>
                                                        {displayStatus}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-[var(--color-muted)] font-medium">
                                                    {topic.subject_name} • {topic.correct}/{topic.total} questions correct
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="w-32 bg-[var(--color-border)] h-2 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${
                                                            topic.accuracy >= 70 ? 'bg-[var(--color-success)]' : topic.accuracy >= 40 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-error)]'
                                                        }`}
                                                        style={{ width: `${topic.accuracy}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono font-bold text-sm text-[var(--color-text)] w-12 text-right">
                                                    {topic.accuracy}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {!scoringPending && activeTab === 'review' && (
                        <div className="space-y-4">
                            {result.detailed_results?.map((q, idx) => {
                                const isExpanded = expandedQuestion === idx;

                                return (
                                    <div
                                        key={q.question_id || idx}
                                        className={`rounded-2xl border transition-all overflow-hidden ${
                                            q.is_correct
                                                ? 'bg-[var(--color-success-5)] border-[var(--color-success)]/20'
                                                : 'bg-[var(--color-error-5)] border-[var(--color-error)]/20'
                                        }`}
                                    >
                                        <button
                                            onClick={() => setExpandedQuestion(isExpanded ? null : idx)}
                                            className="w-full p-4 text-left flex items-start justify-between gap-4 cursor-pointer"
                                        >
                                            <div className="flex items-start gap-3">
                                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 mt-0.5 ${
                                                    q.is_correct ? 'bg-[var(--color-success)] text-white' : 'bg-[var(--color-error)] text-white'
                                                }`}>
                                                    {idx + 1}
                                                </span>
                                                <div>
                                                    <div className="font-bold text-sm text-[var(--color-text)] line-clamp-2 [&_p]:inline">
                                                        <RichText text={formatMathText(q.question_text)} />
                                                    </div>
                                                    <div className="text-xs text-[var(--color-muted)] mt-1">
                                                        Topic: <strong>{q.topic?.name}</strong> • Your choice: <span className={q.is_correct ? 'text-[var(--color-success)] font-bold' : 'text-[var(--color-error)] font-bold'}>{q.selected_option_text || 'Skipped'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <span className="text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider shrink-0">
                                                {isExpanded ? '▲ Hide' : '▼ Details'}
                                            </span>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-4 md:p-6 border-t border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
                                                {q.passage_text && (
                                                    <div className="p-3 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs italic text-[var(--color-muted)] chat-markdown">
                                                        <RichText text={formatMathText(q.passage_text)} />
                                                    </div>
                                                )}

                                                {!q.passage_text && extractLiteratureContext(q.explanation) && (
                                                    <div className="p-3 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary-20)] flex items-center gap-2.5 text-xs">
                                                        <BookOpen className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                                                        <span className="text-[var(--color-text)] font-semibold">
                                                            Based on: <strong className="text-[var(--color-primary)]">{extractLiteratureContext(q.explanation)}</strong>
                                                        </span>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    {q.options?.map((opt, optIdx) => {
                                                        const isSelected = opt.is_selected;
                                                        const isCorrectOpt = opt.is_correct;

                                                        let style = 'border-[var(--color-border)] bg-[var(--color-surface)]';
                                                        if (isCorrectOpt) style = 'border-[var(--color-success)] bg-[var(--color-success-10)] text-[var(--color-success)] font-bold';
                                                        if (isSelected && !isCorrectOpt) style = 'border-[var(--color-error)] bg-[var(--color-error-10)] text-[var(--color-error)] font-bold';

                                                        return (
                                                            <div
                                                                key={opt.id || optIdx}
                                                                className={`p-3 rounded-xl border text-xs flex items-center justify-between ${style}`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <span className="font-extrabold uppercase w-5 text-center">{opt.label || chrFromIdx(optIdx)}.</span>
                                                                    <span className="[&_p]:inline">
                                                                        <RichText text={formatMathText(opt.option_text)} />
                                                                    </span>
                                                                </div>
                                                                {isCorrectOpt && <span className="text-[10px] font-extrabold uppercase text-[var(--color-success)]">✓ Correct</span>}
                                                                {isSelected && !isCorrectOpt && <span className="text-[10px] font-extrabold uppercase text-[var(--color-error)]">✗ Your Choice</span>}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {q.explanation && (
                                                    <div className="p-4 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] text-xs text-[var(--color-text)] leading-relaxed chat-markdown">
                                                        <strong className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-primary)] mb-1">
                                                            Solution & Step-by-Step Working:
                                                        </strong>
                                                        <RichText text={formatMathText(q.explanation)} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-4 sm:px-6 md:px-8 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto text-center justify-center px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                        Back to Hub
                    </button>

                    <button
                        onClick={onRetake}
                        className="w-full sm:w-auto text-center justify-center px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold hover:bg-[var(--color-primary-hover)] transition-all shadow-md cursor-pointer"
                    >
                        Retake Exam ↻
                    </button>
                </div>
            </div>
        </div>
    );
};

function chrFromIdx(index: number): string {
    return String.fromCharCode(65 + index);
}
