import React, { useRef } from 'react';
import type { ClassItem, SubjectItem, TopicItem } from '@/types/admin';
import type { ExtractedQuestion } from '@/utils/questionParser';
import ExtractedQuestionCard from './ExtractedQuestionCard';

interface AIBulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    step: 'input' | 'review';
    setStep: (step: 'input' | 'review') => void;
    bulkClassId: string;
    setBulkClassId: (id: string) => void;
    bulkSubjectId: string;
    setBulkSubjectId: (id: string) => void;
    bulkTopicId: string;
    setBulkTopicId: (id: string) => void;
    rawText: string;
    setRawText: (text: string) => void;
    loading: boolean;
    extractedQuestions: ExtractedQuestion[];
    setExtractedQuestions: React.Dispatch<React.SetStateAction<ExtractedQuestion[]>>;
    isSubmitting: boolean;
    classes: ClassItem[];
    subjects: SubjectItem[];
    allTopics: TopicItem[];
    onExtract: () => void;
    onSave: () => void;
    showToast: (text: string, type?: 'success' | 'error') => void;
}

export default function AIBulkImportModal({
    isOpen,
    onClose,
    step,
    setStep,
    bulkClassId,
    setBulkClassId,
    bulkSubjectId,
    setBulkSubjectId,
    bulkTopicId,
    setBulkTopicId,
    rawText,
    setRawText,
    loading,
    extractedQuestions,
    setExtractedQuestions,
    isSubmitting,
    classes,
    subjects,
    allTopics,
    onExtract,
    onSave,
    showToast,
}: AIBulkImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setRawText(content);
                showToast(`Loaded ${file.name} into text area`, 'success');
            }
        };
        reader.readAsText(file);
    };

    const handlePasteSample = () => {
        setRawText(`1. What is the process by which green plants manufacture food using sunlight?
A) Respiration
B) Photosynthesis
C) Transpiration
D) Fermentation
Answer: B
Explanation: Photosynthesis uses chlorophyll, carbon dioxide, water, and sunlight to make glucose and oxygen.

2. Which organelle is known as the powerhouse of the cell?
A) Ribosome
B) Nucleus
C) Mitochondria
D) Endoplasmic reticulum

3. What is the value of x if 2x + 6 = 18?
A) 4
B) 6
C) 8
D) 12

4. The atomic number of Carbon is:
A) 12
B) 6
C) 14
D) 8`);
    };

    const handleSetCorrectOption = (qIdx: number, optIdx: number) => {
        const updated = [...extractedQuestions];
        updated[qIdx].options = updated[qIdx].options.map((opt, i) => ({
            ...opt,
            is_correct: i === optIdx,
        }));
        setExtractedQuestions(updated);
    };

    const handleUpdateQuestionText = (qIdx: number, text: string) => {
        const updated = [...extractedQuestions];
        updated[qIdx].question_text = text;
        setExtractedQuestions(updated);
    };

    const handleUpdateOptionText = (qIdx: number, optIdx: number, text: string) => {
        const updated = [...extractedQuestions];
        updated[qIdx].options[optIdx].option_text = text;
        setExtractedQuestions(updated);
    };

    const handleUpdateDifficulty = (qIdx: number, difficulty: string) => {
        const updated = [...extractedQuestions];
        updated[qIdx].difficulty = difficulty;
        setExtractedQuestions(updated);
    };

    const handleUpdateExplanation = (qIdx: number, text: string) => {
        const updated = [...extractedQuestions];
        updated[qIdx].explanation = text;
        setExtractedQuestions(updated);
    };

    const handleDeleteExtractedQuestion = (qIdx: number) => {
        const updated = extractedQuestions.filter((_, i) => i !== qIdx);
        setExtractedQuestions(updated);
    };

    const handleAddOptionToQuestion = (qIdx: number) => {
        const updated = [...extractedQuestions];
        updated[qIdx].options.push({
            option_text: '',
            is_correct: false,
            sort_order: updated[qIdx].options.length,
        });
        setExtractedQuestions(updated);
    };

    const handleRemoveOptionFromQuestion = (qIdx: number, optIdx: number) => {
        const updated = [...extractedQuestions];
        if (updated[qIdx].options.length <= 2) {
            showToast('A question must have at least 2 options', 'error');
            return;
        }
        const wasCorrect = updated[qIdx].options[optIdx].is_correct;
        updated[qIdx].options = updated[qIdx].options.filter((_, i) => i !== optIdx);
        if (wasCorrect && updated[qIdx].options.length > 0) {
            updated[qIdx].options[0].is_correct = true;
        }
        setExtractedQuestions(updated);
    };

    const handleAddBlankQuestion = () => {
        setExtractedQuestions([
            ...extractedQuestions,
            {
                question_text: 'New Question Prompt',
                type: 'multiple_choice',
                difficulty: 'medium',
                explanation: null,
                options: [
                    { option_text: 'Option A', is_correct: true },
                    { option_text: 'Option B', is_correct: false },
                    { option_text: 'Option C', is_correct: false },
                    { option_text: 'Option D', is_correct: false },
                ],
            },
        ]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
                {/* Header */}
                <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-surface)]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 flex items-center justify-center shadow-sm">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-extrabold text-[var(--color-text)] flex items-center gap-2">
                                AI Bulk Question Import & Solver
                                <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary)]/20">
                                    {step === 'input' ? 'Step 1: Input & Extract' : 'Step 2: Review & Solve'}
                                </span>
                            </h3>
                            <p className="text-xs text-[var(--color-muted)]">
                                {step === 'input'
                                    ? 'Paste raw exam text or upload a document. AI will parse options and guess the correct answer.'
                                    : 'Review AI-extracted questions, verify or change answers, and save all to your Question Bank.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-all cursor-pointer"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {step === 'input' ? (
                        <div className="space-y-5">
                            {/* Class & Subject & Topic Selection */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                                        Target Class (Optional)
                                    </label>
                                    <select
                                        value={bulkClassId}
                                        onChange={(e) => {
                                            const cId = e.target.value;
                                            setBulkClassId(cId);
                                            setBulkSubjectId('');
                                            setBulkTopicId('');
                                        }}
                                        className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="">All Classes / General</option>
                                        {classes.map((cls) => (
                                            <option key={cls.id} value={cls.id}>
                                                {cls.name} ({cls.grade_level})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                                        Target Subject
                                    </label>
                                    <select
                                        value={bulkSubjectId}
                                        onChange={(e) => {
                                            const sId = e.target.value;
                                            setBulkSubjectId(sId);
                                            const matchingTopics = allTopics.filter((t) => !sId || String(t.subject_id) === sId);
                                            if (matchingTopics.length > 0) {
                                                setBulkTopicId(String(matchingTopics[0].id));
                                            }
                                        }}
                                        className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="">Select Subject (Optional)</option>
                                        {subjects
                                            .filter((s) => !bulkClassId || !s.class_id || String(s.class_id) === bulkClassId)
                                            .map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-[var(--color-text)] mb-1.5">
                                        Target Topic *
                                    </label>
                                    <select
                                        required
                                        value={bulkTopicId}
                                        onChange={(e) => setBulkTopicId(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                                    >
                                        <option value="">Select Topic</option>
                                        {allTopics
                                            .filter((t) => !bulkSubjectId || String(t.subject_id) === bulkSubjectId)
                                            .map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.name} ({t.level})
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            {/* Text Area & File Drop */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                                        <span>Paste Raw Questions Text</span>
                                        <span className="text-[10px] font-normal text-[var(--color-muted)]">
                                            (Word, PDF, WhatsApp or plain text)
                                        </span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            accept=".txt,.csv"
                                            className="hidden"
                                            onChange={handleFileUpload}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] rounded-lg transition-all border border-[var(--color-border)] flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            Upload .txt / .csv
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handlePasteSample}
                                            className="px-2.5 py-1 text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] rounded-lg transition-all border border-[var(--color-primary)]/30 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                            </svg>
                                            Paste Sample Questions
                                        </button>
                                    </div>
                                </div>

                                <textarea
                                    rows={12}
                                    value={rawText}
                                    onChange={(e) => setRawText(e.target.value)}
                                    placeholder={`Paste multiple questions in any format, e.g.:

1. What is the powerhouse of the cell?
A) Ribosome
B) Mitochondria
C) Nucleus
D) Cell Wall

2. Solve 3x + 9 = 24
A) 3
B) 5
C) 7
D) 9
Ans: B`}
                                    className="w-full px-4 py-3 bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl text-xs text-[var(--color-text)] outline-none resize-none font-mono leading-relaxed focus:border-[var(--color-primary)]"
                                />
                            </div>

                            {/* Format Hint */}
                            <div className="p-3.5 rounded-2xl bg-[var(--color-primary-5)] border border-[var(--color-primary)]/15 flex items-start gap-3">
                                <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-[11px] text-[var(--color-muted)] leading-relaxed">
                                    <strong className="text-[var(--color-text)]">Smart Solver:</strong> If your text includes an answer key (e.g.{' '}
                                    <code className="text-[var(--color-primary)] font-bold bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">Answer: C</code> or marked with an asterisk{' '}
                                    <code className="text-[var(--color-primary)] font-bold bg-[var(--color-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)]">*</code>), the AI will retain it. If no answer is provided, the AI will accurately calculate and solve the question with an explanation!
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Step 2: Review Screen */
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-[var(--color-background)] p-4 rounded-2xl border border-[var(--color-border)]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-[var(--color-success-10)] text-[var(--color-success)] flex items-center justify-center border border-[var(--color-success)]/20">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-[var(--color-text)]">
                                            {extractedQuestions.length} Questions Extracted & Solved
                                        </h4>
                                        <p className="text-[11px] text-[var(--color-muted)]">
                                            Review questions, click radio buttons to adjust the correct answer, or edit text inline.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStep('input')}
                                    className="px-3 py-1.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface)] transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                    <span>Edit Raw Text</span>
                                </button>
                            </div>

                            {/* Question Cards List */}
                            <div className="space-y-4">
                                {extractedQuestions.map((q, qIdx) => (
                                    <ExtractedQuestionCard
                                        key={qIdx}
                                        q={q}
                                        qIdx={qIdx}
                                        onUpdateDifficulty={handleUpdateDifficulty}
                                        onDeleteExtractedQuestion={handleDeleteExtractedQuestion}
                                        onUpdateQuestionText={handleUpdateQuestionText}
                                        onAddOptionToQuestion={handleAddOptionToQuestion}
                                        onSetCorrectOption={handleSetCorrectOption}
                                        onUpdateOptionText={handleUpdateOptionText}
                                        onRemoveOptionFromQuestion={handleRemoveOptionFromQuestion}
                                        onUpdateExplanation={handleUpdateExplanation}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-5 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-xs font-bold text-[var(--color-muted)] hover:text-[var(--color-text)] cursor-pointer"
                    >
                        Cancel
                    </button>

                    {step === 'input' ? (
                        <button
                            type="button"
                            onClick={onExtract}
                            disabled={loading || !rawText.trim() || !bulkTopicId}
                            className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Analyzing & Solving with AI...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                                        />
                                    </svg>
                                    <span>Extract & Solve with AI</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={handleAddBlankQuestion}
                                className="px-4 py-2.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] rounded-xl border border-[var(--color-border)] transition-all cursor-pointer"
                            >
                                + Add Blank Question
                            </button>
                            <button
                                type="button"
                                onClick={onSave}
                                disabled={isSubmitting || extractedQuestions.length === 0}
                                className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Importing to Question Bank...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                        </svg>
                                        <span>Save All ({extractedQuestions.length}) Questions to Bank</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
