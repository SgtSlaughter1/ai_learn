import { useState } from 'react';
import { RichText } from '@/components/common/RichText';
import 'katex/dist/katex.min.css';
import type { ExtractedQuestion } from '@/utils/questionParser';
import QuestionImageUploader from './QuestionImageUploader';
import { formatMathText } from '@/utils/mathFormatter';
import { Image as ImageIcon, Sparkles, Trash2, Check } from 'lucide-react';

interface ExtractedQuestionCardProps {
    q: ExtractedQuestion;
    qIdx: number;
    onUpdateDifficulty: (qIdx: number, difficulty: string) => void;
    onDeleteExtractedQuestion: (qIdx: number) => void;
    onUpdateQuestionText: (qIdx: number, text: string) => void;
    onAddOptionToQuestion: (qIdx: number) => void;
    onSetCorrectOption: (qIdx: number, optIdx: number) => void;
    onUpdateOptionText: (qIdx: number, optIdx: number, text: string) => void;
    onRemoveOptionFromQuestion: (qIdx: number, optIdx: number) => void;
    onUpdateExplanation: (qIdx: number, text: string) => void;
    onUpdateImageUrl?: (qIdx: number, url: string | null) => void;
    showToast?: (text: string, type?: 'success' | 'error') => void;
}

export default function ExtractedQuestionCard({
    q,
    qIdx,
    onUpdateDifficulty,
    onDeleteExtractedQuestion,
    onUpdateQuestionText,
    onAddOptionToQuestion,
    onSetCorrectOption,
    onUpdateOptionText,
    onRemoveOptionFromQuestion,
    onUpdateExplanation,
    onUpdateImageUrl,
    showToast,
}: ExtractedQuestionCardProps) {
    const [showImageUploader, setShowImageUploader] = useState(Boolean(q.image_url));

    const handleAutoFormatPrompt = () => {
        const formatted = formatMathText(q.question_text);
        onUpdateQuestionText(qIdx, formatted);
        showToast?.(`Auto-formatted math for question #${qIdx + 1}`, 'success');
    };

    return (
        <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-2xl p-5 space-y-4 shadow-sm hover:border-[var(--color-primary)]/40 transition-all">
            {/* Card Top */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--color-primary)] text-white font-bold text-xs shadow-sm">
                        #{qIdx + 1}
                    </span>
                    <div className="flex items-center gap-1.5 bg-[var(--color-surface)] p-1 rounded-lg border border-[var(--color-border)]">
                        {(['easy', 'medium', 'hard'] as const).map((diff) => (
                            <button
                                key={diff}
                                type="button"
                                onClick={() => onUpdateDifficulty(qIdx, diff)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                    q.difficulty === diff
                                        ? diff === 'easy'
                                            ? 'bg-[var(--color-success)] text-white shadow-sm'
                                            : diff === 'hard'
                                            ? 'bg-[var(--color-error)] text-white shadow-sm'
                                            : 'bg-[var(--color-accent)] text-white shadow-sm'
                                        : 'text-[var(--color-muted)] hover:text-[var(--color-text)]'
                                }`}
                            >
                                {diff}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Auto-Format Math button */}
                    <button
                        type="button"
                        onClick={handleAutoFormatPrompt}
                        className="p-1.5 px-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-primary)] text-[var(--color-primary)] text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Auto-format math equations into LaTeX"
                    >
                        <Sparkles className="w-3 h-3 text-[var(--color-accent)]" />
                        <span>Format Math</span>
                    </button>

                    {/* Toggle Diagram Attachment */}
                    <button
                        type="button"
                        onClick={() => setShowImageUploader(!showImageUploader)}
                        className={`p-1.5 px-2 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            q.image_url
                                ? 'bg-[var(--color-primary-10)] border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)]'
                        }`}
                        title="Attach diagram to question"
                    >
                        <ImageIcon className="w-3 h-3" />
                        <span>{q.image_url ? 'Diagram Attached' : 'Attach Diagram'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onDeleteExtractedQuestion(qIdx)}
                        className="p-1.5 text-[var(--color-error)] hover:bg-[var(--color-error-5)] rounded-lg transition-all text-xs font-bold flex items-center gap-1 cursor-pointer"
                        title="Delete this question"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>Remove</span>
                    </button>
                </div>
            </div>

            {/* Inline Diagram Attachment if active */}
            {(showImageUploader || q.image_url) && onUpdateImageUrl && (
                <QuestionImageUploader
                    imageUrl={q.image_url}
                    onChange={(url) => onUpdateImageUrl(qIdx, url)}
                    showToast={showToast}
                    label={`Question #${qIdx + 1} Diagram`}
                    description="Upload, drag-and-drop or paste screenshot for this question."
                />
            )}

            {/* Question Text */}
            <div>
                <label className="block text-[11px] font-bold text-[var(--color-muted)] mb-1">
                    Question Text (Supports LaTeX $x^2$)
                </label>
                <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) => onUpdateQuestionText(qIdx, e.target.value)}
                    className="w-full px-3.5 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-text)] outline-none resize-none focus:border-[var(--color-primary)] font-mono"
                />
                {q.question_text &&
                    (q.question_text.includes('$') ||
                        q.question_text.includes('\\') ||
                        q.question_text.includes('^')) && (
                        <div className="mt-1 px-3 py-1.5 bg-[var(--color-primary-5)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] [&_p]:inline flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider shrink-0">
                                Math Preview:
                            </span>
                            <RichText text={q.question_text} />
                        </div>
                    )}
            </div>

            {/* Options List */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--color-muted)]">
                        Options (Select radio for correct answer):
                    </label>
                    <button
                        type="button"
                        onClick={() => onAddOptionToQuestion(qIdx)}
                        className="text-[11px] font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                        + Add Option
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {q.options.map((opt, optIdx) => (
                        <div
                            key={optIdx}
                            onClick={() => onSetCorrectOption(qIdx, optIdx)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                                opt.is_correct
                                    ? 'bg-[var(--color-success-10)] border-[var(--color-success)]/40 shadow-sm'
                                    : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-primary)]/30'
                            }`}
                        >
                            <input
                                type="radio"
                                name={`bulk_correct_${qIdx}`}
                                checked={opt.is_correct}
                                onChange={() => onSetCorrectOption(qIdx, optIdx)}
                                className="h-4 w-4 text-[var(--color-success)] cursor-pointer accent-[var(--color-success)]"
                            />
                            <span className="font-bold text-xs text-[var(--color-muted)] w-5">
                                {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <input
                                type="text"
                                value={opt.option_text}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => onUpdateOptionText(qIdx, optIdx, e.target.value)}
                                className="flex-1 px-2.5 py-1 bg-transparent border-b border-transparent focus:border-[var(--color-primary)] outline-none text-xs text-[var(--color-text)] font-medium font-mono"
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)} text...`}
                            />
                            {opt.is_correct ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-success-10)] text-[var(--color-success)] border border-[var(--color-success)]/30 flex items-center gap-1 shadow-sm shrink-0">
                                    <Check className="w-3 h-3 text-[var(--color-success)]" />
                                    <span>Correct</span>
                                </span>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveOptionFromQuestion(qIdx, optIdx);
                                    }}
                                    className="text-[var(--color-muted)] hover:text-[var(--color-error)] p-1 text-xs shrink-0 cursor-pointer"
                                    title="Remove option"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Explanation */}
            <div>
                <label className="block text-[11px] font-bold text-[var(--color-muted)] mb-1">
                    Solution Explanation
                </label>
                <input
                    type="text"
                    value={q.explanation || ''}
                    onChange={(e) => onUpdateExplanation(qIdx, e.target.value)}
                    placeholder="Explanation for students (supports LaTeX)..."
                    className="w-full px-3.5 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono"
                />
            </div>
        </div>
    );
}
