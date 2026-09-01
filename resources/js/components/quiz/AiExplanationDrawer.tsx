import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Lightbulb, X } from 'lucide-react';

interface AiExplanationDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    questionText: string;
    content: string;
    loading: boolean;
}

export function AiExplanationDrawer({
    isOpen,
    onClose,
    questionText,
    content,
    loading,
}: AiExplanationDrawerProps) {
    return (
        <div
            className={`fixed inset-0 z-50 transition-all duration-350 ${
                isOpen
                    ? 'pointer-events-auto bg-black/50 backdrop-blur-sm'
                    : 'pointer-events-none bg-black/0 backdrop-blur-none'
            }`}
            onClick={onClose}
        >
            <div
                className={`absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[var(--color-surface)] backdrop-blur-xl border-l border-[var(--color-border)] shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto transition-transform duration-300 ease-out transform ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="space-y-6 flex-1">
                    <div className="flex justify-between items-center pb-4 border-b border-[var(--color-border)]">
                        <div className="flex items-center space-x-2">
                            <span className="p-2 bg-[var(--color-primary)]/15 text-[var(--color-primary)] rounded-lg">
                                <Lightbulb className="w-5 h-5" />
                            </span>
                            <h3 className="text-lg font-extrabold text-[var(--color-text)]">AI Tutor Insights</h3>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-[var(--color-muted)] hover:text-[var(--color-text)] bg-[var(--color-background)]/40 hover:bg-[var(--color-primary-5)]/60 rounded-xl transition-all border border-[var(--color-border)] cursor-pointer min-h-[38px] flex items-center justify-center"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Question Text in Sidebar */}
                    <div className="p-4.5 bg-[var(--color-background)]/40 rounded-2xl border border-[var(--color-border)]">
                        <span className="block text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider mb-1">
                            Question
                        </span>
                        <p className="text-sm font-semibold text-[var(--color-text)] leading-relaxed">
                            {questionText}
                        </p>
                    </div>

                    {/* AI Explanation Markdown Content */}
                    <div className="space-y-4">
                        {loading ? (
                            <div className="space-y-4 py-8 animate-pulse text-center">
                                <div className="h-6 bg-[var(--color-background)]/80 rounded w-1/3 mx-auto" />
                                <div className="h-4 bg-[var(--color-background)]/80 rounded w-5/6 mx-auto" />
                                <div className="h-4 bg-[var(--color-background)]/80 rounded w-2/3 mx-auto" />
                                <div className="h-4 bg-[var(--color-background)]/80 rounded w-4/5 mx-auto" />
                                <p className="text-xs text-[var(--color-primary)] font-bold tracking-wider mt-4">
                                    Consulting curriculum models...
                                </p>
                            </div>
                        ) : (
                            <div className="chat-markdown text-[var(--color-text)] text-sm leading-relaxed space-y-3 font-medium">
                                <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                    {content}
                                </Markdown>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-6 border-t border-[var(--color-border)] mt-8">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full inline-flex items-center justify-center py-3 bg-[var(--color-background)] hover:bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] rounded-xl font-bold transition-all min-h-[48px] cursor-pointer"
                    >
                        Got It, Thanks!
                    </button>
                </div>
            </div>
        </div>
    );
}
