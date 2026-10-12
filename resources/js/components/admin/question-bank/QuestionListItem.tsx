import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { QuestionItem } from '@/types/admin';
import { Image as ImageIcon, Maximize2, X } from 'lucide-react';

interface QuestionListItemProps {
    question: QuestionItem;
    onEdit: (q: QuestionItem) => void;
    onDelete: (q: QuestionItem) => void;
    isDeleting?: boolean;
}

export default function QuestionListItem({ question: q, onEdit, onDelete, isDeleting = false }: QuestionListItemProps) {
    const [previewModalOpen, setPreviewModalOpen] = useState(false);

    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5 hover:border-[var(--color-primary)]/40 transition-colors">
            {/* Top Bar: Badges + Action Buttons */}
            <div className="flex items-center justify-between gap-2.5 pb-0.5">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="px-2 py-0.5 rounded bg-[var(--color-primary-5)] text-[var(--color-primary)] text-[10px] font-bold uppercase border border-[var(--color-border)] truncate max-w-[200px] sm:max-w-none">
                        {q.topic?.subject?.name || 'Subject'} • {q.topic?.name || 'Topic'}
                    </span>
                    {q._pendingSync && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent)]/25 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse"></span>
                            Pending Sync
                        </span>
                    )}
                    <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border shrink-0 ${
                            q.difficulty === 'easy'
                                ? 'bg-[var(--color-success-10)] text-[var(--color-success)] border-[var(--color-success)]/20'
                                : q.difficulty === 'hard'
                                ? 'bg-[var(--color-error-10)] text-[var(--color-error)] border-[var(--color-error)]/20'
                                : 'bg-[var(--color-accent-10)] text-[var(--color-accent)] border-[var(--color-accent)]/20'
                        }`}
                    >
                        {q.difficulty}
                    </span>
                    {q.image_url && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--color-primary-10)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 shrink-0">
                            <ImageIcon className="w-3 h-3" />
                            <span className="hidden sm:inline">Diagram Attached</span>
                        </span>
                    )}
                </div>

                {/* Edit & Delete Actions */}
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <button
                        type="button"
                        onClick={() => onEdit(q)}
                        disabled={isDeleting}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-5)] active:scale-[0.98] disabled:opacity-50 cursor-pointer rounded-lg transition-all border border-[var(--color-border)]"
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(q)}
                        disabled={isDeleting}
                        className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs font-bold text-[var(--color-error)] hover:bg-[var(--color-error-5)] active:scale-[0.98] disabled:opacity-50 cursor-pointer rounded-lg transition-all flex items-center gap-1"
                    >
                        {isDeleting ? (
                            <>
                                <span className="w-3 h-3 border-2 border-[var(--color-error)]/30 border-t-[var(--color-error)] rounded-full animate-spin"></span>
                                <span>Deleting...</span>
                            </>
                        ) : (
                            <span>Delete</span>
                        )}
                    </button>
                </div>
            </div>

            {/* Attached Diagram Thumbnail */}
            {q.image_url && (
                <div className="pt-0.5">
                    <div
                        onClick={() => setPreviewModalOpen(true)}
                        className="inline-flex items-center gap-2.5 p-1.5 pr-3 rounded-xl bg-[var(--color-background)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 transition-all cursor-pointer group"
                    >
                        <div className="w-12 h-10 rounded-lg overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center relative">
                            <img
                                src={q.image_url}
                                alt="Diagram thumbnail"
                                className="w-full h-full object-contain p-0.5"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Maximize2 className="w-3 h-3" />
                            </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[var(--color-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                            View attached diagram
                        </span>
                    </div>
                </div>
            )}

            {/* Full-Width Question Text */}
            <div className="text-sm sm:text-base font-bold text-[var(--color-text)] leading-relaxed [&_p]:inline">
                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {q.question_text}
                </Markdown>
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                {q.options.map((opt, idx) => (
                    <div
                        key={idx}
                        className={`p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-2.5 ${
                            opt.is_correct
                                ? 'border-[var(--color-success)]/40 bg-[var(--color-success-10)] text-[var(--color-success)] font-bold'
                                : 'border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text)]'
                        }`}
                    >
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                            <span className="font-bold text-[var(--color-muted)] shrink-0">
                                {String.fromCharCode(65 + idx)}.
                            </span>
                            <span className="min-w-0 flex-1 break-words [&_p]:inline">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {opt.option_text}
                                </Markdown>
                            </span>
                        </div>
                        {opt.is_correct && (
                            <span className="text-[11px] font-bold flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-md bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20">
                                <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Correct Answer</span>
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {q.explanation && (
                <div className="text-[11px] text-[var(--color-muted)] bg-[var(--color-primary-5)] border border-[var(--color-border)] p-2.5 rounded-xl flex items-start gap-2">
                    <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="[&_p]:inline break-words min-w-0 flex-1">
                        <strong className="text-[var(--color-text)] font-semibold">Explanation: </strong>
                        <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {q.explanation}
                        </Markdown>
                    </div>
                </div>
            )}

            {/* Diagram Lightbox Modal */}
            {previewModalOpen && q.image_url && (
                <div
                    onClick={() => setPreviewModalOpen(false)}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in cursor-zoom-out"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="relative max-w-3xl max-h-[85vh] bg-[var(--color-surface)] p-4 rounded-3xl border border-[var(--color-border)] shadow-2xl flex flex-col items-center"
                    >
                        <button
                            type="button"
                            onClick={() => setPreviewModalOpen(false)}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-all cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                        <img
                            src={q.image_url}
                            alt="Question Diagram"
                            className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
