import Markdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { CachedFlashcard } from '@/db/database';

interface FlashcardCardProps {
    card: CachedFlashcard;
    flipped: boolean;
    onFlip: () => void;
}

export function FlashcardCard({ card, flipped, onFlip }: FlashcardCardProps) {
    return (
        <div className="w-full select-none" style={{ perspective: '1000px' }}>
            <div
                onClick={onFlip}
                className="relative w-full h-[360px] transition-transform duration-500 cursor-pointer"
                style={{
                    transformStyle: 'preserve-3d',
                    transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
            >
                {/* Front Side */}
                <div
                    className="absolute inset-0 w-full h-full rounded-3xl border border-[var(--color-border)] p-8 flex flex-col justify-between bg-[var(--color-surface)] backdrop-blur-md hover:border-[var(--color-border)] transition-colors shadow-lg"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20 rounded-md tracking-wider uppercase">
                                {card.subject_name}
                            </span>
                            <span className="text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-wider">
                                {card.topic_name}
                            </span>
                        </div>
                        <div className="chat-markdown text-xl font-bold leading-relaxed text-[var(--color-text)] pt-4">
                            <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                {card.question_text}
                            </Markdown>
                        </div>
                    </div>
                    <div className="text-center text-xs font-semibold text-[var(--color-primary)]/80 flex items-center justify-center gap-1.5 pt-4 border-t border-[var(--color-border)]/50">
                        <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>Click card to flip and review answer</span>
                    </div>
                </div>

                {/* Back Side */}
                <div
                    className="absolute inset-0 w-full h-full rounded-3xl border border-[var(--color-primary)]/20 p-8 flex flex-col justify-between bg-teal-950/20 backdrop-blur-md shadow-lg"
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                        border: '1px solid rgba(20, 184, 166, 0.2)',
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    <div className="space-y-4 flex-1 overflow-y-auto pr-1">
                        <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 bg-[var(--color-success)]/10 text-[var(--color-success)] border border-[var(--color-success)]/20 rounded-md tracking-wider uppercase">
                                Correct Answer
                            </span>
                        </div>
                        <h3 className="text-lg font-bold text-[var(--color-text)]">{card.correct_answer}</h3>
                        {card.explanation && (
                            <div className="p-4 bg-[var(--color-background)]/60 border border-[var(--color-border)] rounded-2xl space-y-1.5 mt-2">
                                <span className="block text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider">
                                    AI Explanation
                                </span>
                                <div className="chat-markdown text-xs text-[var(--color-muted)] leading-relaxed">
                                    <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {card.explanation}
                                    </Markdown>
                                </div>
                            </div>
                        )}
                    </div>
                    <div
                        className="text-center text-xs font-semibold text-[var(--color-muted)] mt-4 pt-3 border-t border-[var(--color-border)]/50 cursor-pointer hover:text-[var(--color-text)] flex items-center justify-center gap-1.5"
                        onClick={onFlip}
                    >
                        <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Click here to flip back</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
