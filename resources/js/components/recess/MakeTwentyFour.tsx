import { useState } from 'react';
import { RotateCcw, SkipForward, Undo2 } from 'lucide-react';
import { applyOp, formatFraction, frac, isTarget, make24Puzzle, type Fraction, type Op } from './logic';

interface Props {
    onWin: () => void;
}

interface Card {
    id: number;
    value: Fraction;
}

const OPS: Op[] = ['+', '−', '×', '÷'];

const startCards = (nums: number[]): Card[] => nums.map((n, i) => ({ id: i, value: frac(n) }));

/**
 * Pick a number, an operation, then another number: the two become their result. Use all
 * four numbers to finish on 24. Fractions are kept exact, so 8 ÷ 3 can still lead to 24.
 */
export default function MakeTwentyFour({ onWin }: Props) {
    const [puzzle, setPuzzle] = useState(() => make24Puzzle());
    const [cards, setCards] = useState<Card[]>(() => startCards(puzzle));
    const [history, setHistory] = useState<Card[][]>([]);
    const [picked, setPicked] = useState<number | null>(null);
    const [op, setOp] = useState<Op | null>(null);
    const [message, setMessage] = useState('Make 24 using all four numbers once each.');
    const [solved, setSolved] = useState(false);
    const [streak, setStreak] = useState(0);

    const choose = (card: Card) => {
        if (solved) return;
        if (picked === null || op === null) {
            setPicked(card.id === picked ? null : card.id);
            return;
        }
        if (card.id === picked) return;
        const first = cards.find((c) => c.id === picked)!;
        const result = applyOp(first.value, op, card.value);
        if (!result) {
            setMessage("You can't divide by zero. Pick another number.");
            return;
        }
        const nextId = Math.max(...cards.map((c) => c.id)) + 1;
        const next = [...cards.filter((c) => c.id !== first.id && c.id !== card.id), { id: nextId, value: result }];
        setHistory((h) => [...h, cards]);
        setCards(next);
        setPicked(nextId);
        setOp(null);

        if (next.length === 1) {
            if (isTarget(result)) {
                setSolved(true);
                setStreak((s) => s + 1);
                setMessage('24! Well done.');
                onWin();
            } else {
                setMessage(`That makes ${formatFraction(result)}, not 24. Undo and try another way.`);
            }
        } else {
            setMessage('Keep going: pick an operation, then another number.');
        }
    };

    const undo = () => {
        const previous = history[history.length - 1];
        if (!previous || solved) return;
        setCards(previous);
        setHistory((h) => h.slice(0, -1));
        setPicked(null);
        setOp(null);
        setMessage('Make 24 using all four numbers once each.');
    };

    const restart = (nums = puzzle) => {
        setCards(startCards(nums));
        setHistory([]);
        setPicked(null);
        setOp(null);
        setSolved(false);
        setMessage('Make 24 using all four numbers once each.');
    };

    const nextPuzzle = () => {
        const nums = make24Puzzle();
        setPuzzle(nums);
        if (!solved) setStreak(0);
        restart(nums);
    };

    const tool = 'inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

    return (
        <div className="max-w-md mx-auto space-y-5">
            <div className="grid grid-cols-2 gap-3">
                {cards.map((card) => (
                    <button
                        key={card.id}
                        type="button"
                        onClick={() => choose(card)}
                        aria-pressed={card.id === picked}
                        className={`h-24 rounded-2xl text-3xl font-extrabold tabular-nums transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                            solved
                                ? 'col-span-2 bg-[var(--color-primary)] text-white'
                                : card.id === picked
                                ? 'bg-[var(--color-primary)] text-white ring-4 ring-[var(--color-primary)]/20'
                                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50'
                        }`}
                    >
                        {formatFraction(card.value)}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Operations">
                {OPS.map((o) => (
                    <button
                        key={o}
                        type="button"
                        disabled={picked === null || cards.length < 2 || solved}
                        onClick={() => setOp(o === op ? null : o)}
                        aria-pressed={o === op}
                        className={`h-14 rounded-xl text-2xl font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            o === op ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]'
                        }`}
                    >
                        {o}
                    </button>
                ))}
            </div>

            <p className="text-center text-sm text-[var(--color-muted)] min-h-10" aria-live="polite">{message}</p>

            <div className="flex flex-wrap items-center justify-center gap-2">
                <button type="button" onClick={undo} disabled={history.length === 0 || solved} className={tool}>
                    <Undo2 className="w-4 h-4" aria-hidden /> Undo
                </button>
                <button type="button" onClick={() => restart()} disabled={history.length === 0 && !solved} className={tool}>
                    <RotateCcw className="w-4 h-4" aria-hidden /> Start over
                </button>
                <button type="button" onClick={nextPuzzle} className={`${tool} ${solved ? 'bg-[var(--color-primary)] text-white border-transparent' : ''}`}>
                    <SkipForward className="w-4 h-4" aria-hidden /> {solved ? 'Next puzzle' : 'Skip'}
                </button>
            </div>
            {streak > 1 && <p className="text-center text-xs font-bold text-[var(--color-primary)]">{streak} in a row</p>}
        </div>
    );
}
