interface QuestionPaletteProps {
    totalQuestions: number;
    currentIndex: number;
    answeredIndices: Set<number>;
    onSelectIndex: (index: number) => void;
}

export function QuestionPalette({
    totalQuestions,
    currentIndex,
    answeredIndices,
    onSelectIndex,
}: QuestionPaletteProps) {
    if (totalQuestions <= 1) return null;

    return (
        <div className="flex items-center gap-1.5 flex-wrap justify-center py-2 px-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)] rounded-2xl">
            {Array.from({ length: totalQuestions }).map((_, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = answeredIndices.has(idx);

                let badgeClass = 'bg-[var(--color-background)] text-[var(--color-muted)] border-[var(--color-border)]';
                if (isCurrent) {
                    badgeClass = 'bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-sm';
                } else if (isAnswered) {
                    badgeClass = 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30';
                }

                return (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => onSelectIndex(idx)}
                        className={`h-8 w-8 rounded-lg border text-xs font-bold transition-all focus:outline-none cursor-pointer flex items-center justify-center ${badgeClass}`}
                        title={`Go to Question ${idx + 1}`}
                    >
                        {idx + 1}
                    </button>
                );
            })}
        </div>
    );
}
