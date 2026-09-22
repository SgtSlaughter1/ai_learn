import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { PastQuestionItem, ExamSimulationResult } from '../../types/past-questions';

interface Props {
    questions: PastQuestionItem[];
    examCode: string;
    examTitle: string;
    subjectTitle: string;
    yearTitle?: string;
    durationMinutes: number;
    simulationId?: number;
    onFinish: (result: ExamSimulationResult) => void;
    onCancel: () => void;
}

export const ExamSimulationModal: React.FC<Props> = ({
    questions,
    examCode,
    examTitle,
    subjectTitle,
    yearTitle,
    durationMinutes,
    simulationId,
    onFinish,
    onCancel,
}) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
    const [flagged, setFlagged] = useState<Record<number, boolean>>({});
    const [secondsRemaining, setSecondsRemaining] = useState<number>(durationMinutes * 60);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
    const [showCalculator, setShowCalculator] = useState<boolean>(false);
    const [calcDisplay, setCalcDisplay] = useState<string>('0');

    const totalSeconds = durationMinutes * 60;
    const timeSpentSeconds = totalSeconds - secondsRemaining;

    useEffect(() => {
        if (secondsRemaining <= 0) {
            handleFinalSubmit();
            return;
        }

        const timer = setInterval(() => {
            setSecondsRemaining(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsRemaining]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const currentQ = questions[currentIndex];
    const answeredCount = Object.keys(selectedAnswers).length;
    const flaggedCount = Object.values(flagged).filter(Boolean).length;
    const unansweredCount = questions.length - answeredCount;

    const handleSelectOption = (optId: number) => {
        setSelectedAnswers(prev => ({
            ...prev,
            [currentQ.id]: optId,
        }));
    };

    const toggleFlag = () => {
        setFlagged(prev => ({
            ...prev,
            [currentQ.id]: !prev[currentQ.id],
        }));
    };

    const handleFinalSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/v1/past-questions/simulation/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    simulation_id: simulationId,
                    exam_code: examCode,
                    exam_year: currentQ?.exam_year,
                    time_spent_seconds: timeSpentSeconds,
                    answers: selectedAnswers,
                }),
            });

            const data = await res.json();
            if (data.success) {
                onFinish(data.data);
            } else {
                alert('Submission failed. Please try again.');
                setIsSubmitting(false);
            }
        } catch (err) {
            console.error('Submit error:', err);
            alert('Failed to submit exam attempt.');
            setIsSubmitting(false);
        }
    };

    const handleCalcInput = (char: string) => {
        if (char === 'C') {
            setCalcDisplay('0');
        } else if (char === '=') {
            try {
                const sanitized = calcDisplay.replace(/[^0-9+\-*/.]/g, '');
                // eslint-disable-next-line no-eval
                const result = Function(`'use strict'; return (${sanitized})`)();
                setCalcDisplay(String(result));
            } catch {
                setCalcDisplay('Error');
            }
        } else {
            setCalcDisplay(prev => (prev === '0' || prev === 'Error' ? char : prev + char));
        }
    };

    const isTimerCritical = secondsRemaining < 300;

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)] text-[var(--color-text)] select-none overflow-hidden">
            {/* Top Exam Header */}
            <header className="h-16 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-8 flex items-center justify-between shadow-xs shrink-0">
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-[var(--color-primary)] text-white shadow-xs">
                        {examTitle}
                    </span>
                    <div className="hidden sm:block">
                        <span className="font-bold text-sm text-[var(--color-text)]">{subjectTitle}</span>
                        {yearTitle && <span className="text-xs text-[var(--color-muted)] ml-2">({yearTitle})</span>}
                    </div>
                </div>

                <div className="flex items-center gap-3 md:gap-4">
                    {/* Timer */}
                    <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono font-bold text-sm md:text-base transition-colors ${
                        isTimerCritical
                            ? 'bg-[var(--color-error-10)] border-[var(--color-error)] text-[var(--color-error)] animate-pulse'
                            : 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text)]'
                    }`}>
                        <svg className="w-4 h-4 text-inherit" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTime(secondsRemaining)}</span>
                    </div>

                    {/* Calculator Toggle */}
                    <button
                        onClick={() => setShowCalculator(!showCalculator)}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            showCalculator
                                ? 'bg-[var(--color-primary)] text-white border-transparent'
                                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-surface)]'
                        }`}
                        title="Toggle CBT Calculator"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden md:inline">Calculator</span>
                    </button>

                    {/* Submit Button */}
                    <button
                        onClick={() => setShowSubmitConfirm(true)}
                        className="px-4 py-2 rounded-xl bg-[var(--color-success)] hover:opacity-90 text-white font-bold text-sm transition-opacity shadow-sm cursor-pointer"
                    >
                        Submit Test
                    </button>

                    {/* Exit Button */}
                    <button
                        onClick={onCancel}
                        className="p-2 text-[var(--color-muted)] hover:text-[var(--color-error)] rounded-xl hover:bg-[var(--color-error-10)] transition-colors cursor-pointer"
                        title="Exit Exam"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Main Area */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto">
                    <div className="max-w-3xl w-full mx-auto flex-1 flex flex-col justify-between space-y-6">
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
                            <div className="flex items-center gap-2">
                                <span className="font-extrabold text-lg text-[var(--color-primary)]">
                                    Question {currentIndex + 1}
                                </span>
                                <span className="text-xs text-[var(--color-muted)] font-medium">
                                    of {questions.length}
                                </span>
                                {currentQ.exam_year && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]">
                                        {currentQ.exam_code ? currentQ.exam_code.toUpperCase() : ''} {currentQ.exam_year}
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={toggleFlag}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                    flagged[currentQ.id]
                                        ? 'bg-[var(--color-accent-20)] border-[var(--color-accent)] text-[var(--color-accent)] font-bold'
                                        : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                            >
                                <svg className="w-4 h-4" fill={flagged[currentQ.id] ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                                </svg>
                                {flagged[currentQ.id] ? 'Flagged for Review' : 'Flag for Review'}
                            </button>
                        </div>

                        {currentQ.passage_text && (
                            <div className="p-4 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] text-sm leading-relaxed text-[var(--color-text)] italic chat-markdown">
                                <span className="not-italic text-[10px] font-extrabold text-[var(--color-primary)] uppercase tracking-wider block mb-1">
                                    Read Passage:
                                </span>
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {currentQ.passage_text}
                                </Markdown>
                            </div>
                        )}

                        {currentQ.image_url && (
                            <div className="flex justify-center">
                                <img
                                    src={currentQ.image_url}
                                    alt="CBT Diagram"
                                    className="max-h-56 rounded-2xl border border-[var(--color-border)] shadow-xs object-contain"
                                />
                            </div>
                        )}

                        <div className="text-lg md:text-xl font-bold text-[var(--color-text)] leading-relaxed chat-markdown">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {currentQ.question_text}
                            </Markdown>
                        </div>

                        <div className="space-y-3 pt-2 flex-1">
                            {currentQ.options.map((option, idx) => {
                                const isSelected = selectedAnswers[currentQ.id] === option.id;
                                const label = option.label || chrFromIdx(idx);

                                return (
                                    <button
                                        key={option.id || idx}
                                        onClick={() => handleSelectOption(option.id)}
                                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center gap-4 cursor-pointer ${
                                            isSelected
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary-5)] text-[var(--color-primary)] ring-2 ring-[var(--color-primary-20)] shadow-xs font-semibold'
                                                : 'border-[var(--color-border)] bg-[var(--color-background)]/40 hover:bg-[var(--color-surface-hover)] text-[var(--color-text)]'
                                        }`}
                                    >
                                        <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 transition-colors ${
                                            isSelected
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-muted)]'
                                        }`}>
                                            {label}
                                        </span>
                                        <div className="flex-1 font-semibold text-sm [&_p]:inline">
                                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                                {option.option_text}
                                            </Markdown>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="pt-6 border-t border-[var(--color-border)] flex items-center justify-between">
                            <button
                                disabled={currentIndex === 0}
                                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                className="px-6 py-2.5 rounded-xl border border-[var(--color-border)] font-bold text-sm text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                            >
                                ← Previous
                            </button>

                            <button
                                disabled={currentIndex === questions.length - 1}
                                onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                                className="px-8 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold text-sm hover:bg-[var(--color-primary-hover)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all shadow-md"
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </main>

                {/* Right Sidebar */}
                <aside className="w-full md:w-80 bg-[var(--color-surface)] border-t md:border-t-0 md:border-l border-[var(--color-border)] p-5 flex flex-col shrink-0">
                    <h3 className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-muted)] mb-3">
                        Question Status Palette
                    </h3>

                    <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                        <div className="p-2 rounded-xl bg-[var(--color-success-10)] border border-[var(--color-success-20)]">
                            <span className="block text-base font-black text-[var(--color-success)]">{answeredCount}</span>
                            <span className="text-[9px] font-extrabold uppercase text-[var(--color-success)]">Answered</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[var(--color-accent-10)] border border-[var(--color-accent-20)]">
                            <span className="block text-base font-black text-[var(--color-accent)]">{flaggedCount}</span>
                            <span className="text-[9px] font-extrabold uppercase text-[var(--color-accent)]">Flagged</span>
                        </div>
                        <div className="p-2 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                            <span className="block text-base font-black text-[var(--color-muted)]">{unansweredCount}</span>
                            <span className="text-[9px] font-extrabold uppercase text-[var(--color-muted)]">Left</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto grid grid-cols-5 gap-2 content-start pr-1 max-h-60 md:max-h-none">
                        {questions.map((q, idx) => {
                            const isCurrent = currentIndex === idx;
                            const isAns = selectedAnswers[q.id] !== undefined;
                            const isFlg = Boolean(flagged[q.id]);

                            let tileStyle = 'bg-[var(--color-background)]/60 border-[var(--color-border)] text-[var(--color-muted)]';

                            if (isAns) tileStyle = 'bg-[var(--color-success)] text-white border-transparent font-bold';
                            if (isFlg) tileStyle = 'bg-[var(--color-accent)] text-white border-transparent font-bold';
                            if (isCurrent) tileStyle += ' ring-2 ring-[var(--color-primary)] ring-offset-2';

                            return (
                                <button
                                    key={q.id || idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer ${tileStyle}`}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* Calculator Popup */}
                {showCalculator && (
                    <div className="absolute top-4 right-4 md:right-84 z-40 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-4 shadow-2xl w-64 animate-scale-in">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--color-border)]">
                            <span className="text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider">CBT Calculator</span>
                            <button
                                onClick={() => setShowCalculator(false)}
                                className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl p-2.5 text-right font-mono text-xl font-bold truncate mb-3 text-[var(--color-text)]">
                            {calcDisplay}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {['7','8','9','/','4','5','6','*','1','2','3','-','0','.','=','+','C'].map((btn) => (
                                <button
                                    key={btn}
                                    onClick={() => handleCalcInput(btn)}
                                    className={`h-9 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        btn === 'C'
                                            ? 'col-span-4 bg-[var(--color-error)] text-white mt-1 hover:opacity-90'
                                            : btn === '='
                                            ? 'bg-[var(--color-success)] text-white hover:opacity-90'
                                            : 'bg-[var(--color-surface-hover)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/60 text-[var(--color-text)]'
                                    }`}
                                >
                                    {btn}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Submit Confirmation Dialog */}
            {showSubmitConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center space-y-5">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-20)] flex items-center justify-center mx-auto">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-[var(--color-text)]">Submit Examination?</h3>
                            <p className="text-xs text-[var(--color-muted)] mt-1">
                                Are you sure you want to end this test simulation?
                            </p>
                        </div>

                        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-4 text-xs space-y-2 text-left">
                            <div className="flex justify-between">
                                <span className="text-[var(--color-muted)] font-medium">Total Questions:</span>
                                <strong className="text-[var(--color-text)]">{questions.length}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-success)] font-bold">Answered:</span>
                                <strong className="text-[var(--color-success)]">{answeredCount}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-accent)] font-bold">Flagged for Review:</span>
                                <strong className="text-[var(--color-accent)]">{flaggedCount}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[var(--color-error)] font-bold">Unanswered:</span>
                                <strong className="text-[var(--color-error)]">{unansweredCount}</strong>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowSubmitConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl border border-[var(--color-border)] text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                            >
                                Return to Exam
                            </button>
                            <button
                                disabled={isSubmitting}
                                onClick={handleFinalSubmit}
                                className="flex-1 py-2.5 rounded-xl bg-[var(--color-success)] text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                                {isSubmitting ? 'Grading...' : 'Yes, Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

function chrFromIdx(index: number): string {
    return String.fromCharCode(65 + index);
}
