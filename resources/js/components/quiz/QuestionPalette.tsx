interface QuestionPaletteProps {
    totalQuestions: number;
    currentIndex: number;
    answeredIndices: Set<number>;
    onSelectIndex: (index: number) => void;
    /** Questions about the same passage, shown boxed together with the passage's name. */
    groups?: { start: number; end: number; label: string }[];
}

export function QuestionPalette({
    totalQuestions,
    currentIndex,
    answeredIndices,
    onSelectIndex,
    groups = [],
}: QuestionPaletteProps) {
    if (totalQuestions <= 1) return null;
    const groupAt = new Map(groups.map((g) => [g.start, g]));
    const inGroup = new Set(groups.flatMap((g) => Array.from({ length: g.end - g.start + 1 }, (_, i) => g.start + i)));

    return (
        <div className="flex items-center gap-1.5 flex-wrap justify-center py-2 px-3 bg-[var(--color-surface)]/60 border border-[var(--color-border)] rounded-2xl">
            {Array.from({ length: totalQuestions }).map((_, idx) => {
                const group = groupAt.get(idx);
                if (group) {
                    return (
                        <div key={`g${idx}`} className="flex flex-col gap-1 px-2 py-1.5 rounded-xl bg-[var(--color-primary-5)] border border-[var(--color-primary)]/20">
                            <span className="text-[10px] font-extrabold text-[var(--color-primary)] max-w-[220px] truncate">{group.label}</span>
                            <div className="flex gap-1.5 flex-wrap">
                                {Array.from({ length: group.end - group.start + 1 }, (_, i) => renderButton(group.start + i))}
                            </div>
                        </div>
                    );
                }
                if (inGroup.has(idx)) return null;
                return renderButton(idx);
            })}
        </div>
    );

    function renderButton(idx: number) {
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
    }
}
