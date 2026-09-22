import React, { useState } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PastQuestionItem } from '../../types/past-questions';
import { AiExplanationDrawer } from '../quiz/AiExplanationDrawer';
import { Sparkles } from 'lucide-react';

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
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [bookmarked, setBookmarked] = useState<Record<number, boolean>>({});

    // AI Tutor State
    const [aiTutorOpen, setAiTutorOpen] = useState<boolean>(false);
    const [aiTutorContent, setAiTutorContent] = useState<string>('');
    const [aiTutorLoading, setAiTutorLoading] = useState<boolean>(false);

    if (!questions || questions.length === 0) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
                    <p className="text-base font-bold text-[var(--color-text)]">No questions found for the selected criteria.</p>
                    <button
                        onClick={onClose}
                        className="mt-6 px-6 py-2.5 bg-[var(--color-primary)] text-white font-bold text-sm rounded-xl hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    const currentQ = questions[currentIndex];
    const selectedOptId = selectedAnswers[currentQ.id];
    const isAnswered = selectedOptId !== undefined;
    const isCorrect = isAnswered && currentQ.options.find(o => o.id === selectedOptId)?.is_correct;

    const handleSelectOption = (optId: number) => {
        if (!isAnswered) {
            setSelectedAnswers(prev => ({ ...prev, [currentQ.id]: optId }));
        }
    };

    const toggleBookmark = () => {
        setBookmarked(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }));
    };

    const handleAskAiTutor = async () => {
        setAiTutorOpen(true);
        setAiTutorLoading(true);

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
            if (data.success && data.explanation) {
                setAiTutorContent(data.explanation);
            } else {
                setAiTutorContent(currentQ.explanation || `### AI Tutor Analysis\n\n**Subject:** ${currentQ.subject?.name || 'Subject'}\n\nReview your topic notes for this question.`);
            }
        } catch (e) {
            // Offline fallback
            setAiTutorContent(currentQ.explanation || `### AI Tutor (Offline Mode)\n\n**Subject:** ${currentQ.subject?.name || 'Subject'}\n\nOperating offline. Review your standard formula sheets and curriculum notes.`);
        } finally {
            setAiTutorLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header Bar */}
                <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                {currentQ.exam_code ? currentQ.exam_code.toUpperCase() : examTitle}
                            </span>
                            {currentQ.exam_year && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                    Year {currentQ.exam_year}
                                </span>
                            )}
                            <span className="text-xs font-semibold text-[var(--color-muted)]">
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

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleAskAiTutor}
                            className="px-3 py-1.5 rounded-xl border border-[var(--color-primary-20)] bg-[var(--color-primary-5)] hover:bg-[var(--color-primary-10)] text-[var(--color-primary)] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Ask AI Tutor for guidance"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Ask AI Tutor</span>
                        </button>
                        <button
                            onClick={toggleBookmark}
                            className={`p-2 rounded-xl border transition-all cursor-pointer ${
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
                            className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-xl hover:bg-[var(--color-border)]/50 transition-colors cursor-pointer"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Question Body */}
                <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
                    {/* Topic Badge */}
                    {currentQ.topic?.name && (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-primary-5)] border border-[var(--color-border)] text-[var(--color-muted)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"></span>
                            Topic: <strong className="text-[var(--color-text)]">{currentQ.topic.name}</strong>
                        </div>
                    )}

                    {/* Comprehension Passage */}
                    {currentQ.passage_text && (
                        <div className="p-5 rounded-2xl bg-[var(--color-background)] border border-[var(--color-border)] text-sm text-[var(--color-text)] leading-relaxed italic">
                            <p className="font-bold not-italic text-[10px] uppercase tracking-wider text-[var(--color-primary)] mb-2">
                                Reading Comprehension Passage:
                            </p>
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {currentQ.passage_text}
                            </Markdown>
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
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {currentQ.question_text}
                        </Markdown>
                    </div>

                    {/* Options List */}
                    <div className="space-y-3 pt-2">
                        {currentQ.options.map((option, idx) => {
                            const isSelected = selectedOptId === option.id;
                            const isOptionCorrect = option.is_correct;
                            
                            let optionStyle = 'border-[var(--color-border)] bg-[var(--color-background)]/40 hover:bg-[var(--color-surface-hover)] hover:border-[var(--color-primary-light)]';
                            let badgeStyle = 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]';

                            if (isAnswered) {
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
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 transition-colors ${badgeStyle}`}>
                                        {option.label || chrFromIdx(idx)}
                                    </span>
                                    <div className="flex-1 pt-1 font-semibold text-sm text-[var(--color-text)] [&_p]:inline">
                                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                            {option.option_text}
                                        </Markdown>
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

                    {/* Instant Explanation & Solution Card */}
                    {isAnswered && (
                        <div className={`p-5 rounded-2xl border transition-all animate-fade-in ${
                            isCorrect
                                ? 'bg-[var(--color-success-5)] border-[var(--color-success)]/30'
                                : 'bg-[var(--color-error-5)] border-[var(--color-error)]/30'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md border ${
                                    isCorrect
                                        ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success-20)]'
                                        : 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error-20)]'
                                }`}>
                                    {isCorrect ? '✓ Correct Answer' : '✗ Incorrect Answer'}
                                </span>
                            </div>

                            {currentQ.explanation ? (
                                <div className="mt-3 text-sm text-[var(--color-text)] leading-relaxed chat-markdown">
                                    <strong className="block text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-muted)] mb-1">
                                        Step-by-Step Solution & Working:
                                    </strong>
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {currentQ.explanation}
                                    </Markdown>
                                </div>
                            ) : (
                                <p className="text-sm text-[var(--color-muted)] mt-2">
                                    Correct option is <strong>{currentQ.options.find(o => o.is_correct)?.label || 'A'}</strong>.
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
                        className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                    >
                        ← Previous
                    </button>

                    <div className="text-xs font-semibold text-[var(--color-muted)]">
                        {currentIndex + 1} / {questions.length} Questions
                    </div>

                    <button
                        disabled={currentIndex === questions.length - 1}
                        onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                        className="px-6 py-2.5 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md cursor-pointer"
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* AI Tutor Insights Drawer */}
            <AiExplanationDrawer
                isOpen={aiTutorOpen}
                onClose={() => setAiTutorOpen(false)}
                questionText={currentQ.question_text}
                content={aiTutorContent}
                loading={aiTutorLoading}
            />
        </div>
    );
};

function chrFromIdx(index: number): string {
    return String.fromCharCode(65 + index);
}
