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
                    <div className="text-center text-xs font-semibold text-[var(--color-primary)]/80 animate-pulse pt-4 border-t border-[var(--color-border)]/50">
                        💡 Click card to flip and review answer
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
                        className="text-center text-xs font-semibold text-[var(--color-muted)] mt-4 pt-3 border-t border-[var(--color-border)]/50 cursor-pointer hover:text-[var(--color-text)]"
                        onClick={onFlip}
                    >
                        🔄 Click here to flip back
                    </div>
                </div>
            </div>
        </div>
    );
}
