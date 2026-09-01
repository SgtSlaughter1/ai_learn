export type RecallRating = 'again' | 'good' | 'easy';

interface FlashcardRatingBarProps {
    flipped: boolean;
    onRate: (rating: RecallRating) => void;
}

export function FlashcardRatingBar({ flipped, onRate }: FlashcardRatingBarProps) {
    return (
        <div
            className={`grid grid-cols-3 gap-3 transition-opacity duration-300 ${
                flipped ? 'opacity-100 pointer-events-auto' : 'opacity-35 pointer-events-none'
            }`}
        >
            <button
                type="button"
                onClick={() => onRate('again')}
                className="flex flex-col items-center justify-center p-3 bg-[var(--color-error)]/10 hover:bg-rose-500/15 border border-rose-500/25 rounded-2xl transition-all focus:outline-none min-h-[58px] cursor-pointer"
            >
                <span className="text-xs font-bold text-[var(--color-error)]">Again</span>
                <span className="text-[9px] text-rose-500/80 font-bold uppercase mt-0.5">Incorrect</span>
            </button>
            <button
                type="button"
                onClick={() => onRate('good')}
                className="flex flex-col items-center justify-center p-3 bg-[var(--color-accent)]/10 hover:bg-amber-500/15 border border-amber-500/25 rounded-2xl transition-all focus:outline-none min-h-[58px] cursor-pointer"
            >
                <span className="text-xs font-bold text-[var(--color-accent)]">Good</span>
                <span className="text-[9px] text-[var(--color-accent)]/80 font-bold uppercase mt-0.5">Slightly Stuck</span>
            </button>
            <button
                type="button"
                onClick={() => onRate('easy')}
                className="flex flex-col items-center justify-center p-3 bg-[var(--color-success)]/10 hover:bg-emerald-500/15 border border-emerald-500/25 rounded-2xl transition-all focus:outline-none min-h-[58px] cursor-pointer"
            >
                <span className="text-xs font-bold text-[var(--color-success)]">Easy</span>
                <span className="text-[9px] text-[var(--color-success)]/80 font-bold uppercase mt-0.5">Recalled</span>
            </button>
        </div>
    );
}
