import React, { useState, useRef } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PastQuestionItem } from '../../types/past-questions';
import { AiExplanationDrawer } from '../quiz/AiExplanationDrawer';
import { Sparkles, Lightbulb, BookOpen } from 'lucide-react';
import { formatMathText, extractLiteratureContext } from '../../utils/mathFormatter';

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
    const [bookmarked, setBookmarked] = useState<Record<number, boolean>>({});

    // AI Tutor State & In-Memory Cache
    const [aiTutorOpen, setAiTutorOpen] = useState<boolean>(false);
    const [aiTutorContent, setAiTutorContent] = useState<string>('');
    const [aiTutorLoading, setAiTutorLoading] = useState<boolean>(false);
    const explanationCacheRef = useRef<Record<string, string>>({});

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

    const selectedOpt = currentQ.options.find(o => o.id === selectedOptId);
    const correctOpt = currentQ.options.find(o => o.is_correct);

    const generateOfflineExplanation = () => {
        const topicName = currentQ.topic?.name || '';
        const subjectName = currentQ.subject?.name || '';

        let out = `### 1. What You Chose\n\n`;
        if (selectedOpt) {
            if (selectedOpt.is_correct) {
                out += `You chose **"${selectedOpt.label || ''} ${selectedOpt.option_text}"**, which is the **correct answer**! Great work applying curriculum concepts in **${topicName || subjectName || 'this subject'}**.\n\n`;
            } else {
                out += `You chose **"${selectedOpt.label || ''} ${selectedOpt.option_text}"**. This option is a common trap in past examination questions.\n\n`;
            }
        } else {
            out += `You have not selected an option yet. Let's study the method so you can solve it with confidence.\n\n`;
        }

        out += `### 2. Why It Was Incorrect\n\n`;
        if (selectedOpt && !selectedOpt.is_correct) {
            out += `Option **"${selectedOpt.label || ''} ${selectedOpt.option_text}"** does not satisfy the marking scheme or formulas tested in **${topicName || subjectName || 'this question'}**.\n\n`;
        } else {
            out += `Distractor options in ${currentQ.exam_code || 'National'} exams often capture common calculation traps or misapplied definitions.\n\n`;
        }

        out += `### 3. What the Correct Reasoning Is\n\n`;
        if (correctOpt) {
            out += `The correct answer is **"${correctOpt.label || ''} ${correctOpt.option_text}"**.\n\n`;
        }
        if (currentQ.explanation && currentQ.explanation.trim().length > 0) {
            out += `**Step-by-Step Working:**\n${currentQ.explanation.trim()}\n\n`;
        } else if (correctOpt) {
            out += `* **"${correctOpt.label || ''} ${correctOpt.option_text}"** is the official solution according to the examination syllabus.\n\n`;
        }

        out += `### 4. A Simple Example\n\n`;
        out += `* **Key Rule:** When tackling **${subjectName || 'exam'}** questions on **${topicName || 'this topic'}**, write down known formulas and double-check unit conversions and sign rules before picking an option.`;

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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-xs p-3 md:p-6 overflow-y-auto animate-fade-in">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                {/* Header Bar */}
                <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary-20)]">
                                {currentQ.exam_code ? currentQ.exam_code.toUpperCase() : examTitle}
                            </span>
                            {(currentQ.exam_year || yearTitle) && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                    Year {currentQ.exam_year || yearTitle}
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
                        <div className="p-4 md:p-6 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm leading-relaxed text-[var(--color-text)] italic chat-markdown">
                            <p className="not-italic text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider mb-2">
                                Reading Comprehension Passage:
                            </p>
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {formatMathText(currentQ.passage_text)}
                            </Markdown>
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
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {formatMathText(currentQ.question_text)}
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
                                            {formatMathText(option.option_text)}
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
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {selectedOpt ? formatMathText(`${selectedOpt.label || ''} ${selectedOpt.option_text}`) : 'None'}
                                            </Markdown>
                                        </div>
                                    </div>
                                    <div className="p-3 rounded-xl bg-[var(--color-surface)] border border-[var(--color-success)]/30 space-y-1">
                                        <span className="text-[10px] font-bold text-[var(--color-success)] uppercase tracking-wider block">
                                            Correct Answer
                                        </span>
                                        <div className="text-xs font-semibold text-[var(--color-text)] [&_p]:inline">
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {correctOpt ? formatMathText(`${correctOpt.label || ''} ${correctOpt.option_text}`) : 'None'}
                                            </Markdown>
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
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {formatMathText(currentQ.explanation)}
                                    </Markdown>
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
