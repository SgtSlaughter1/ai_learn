import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { buildWordSearch, lineBetween, matchSelection, type Cell } from './logic';

interface Props {
    /** Words to hide, already chosen for the learner's subjects. */
    pool: string[];
    onWin: () => void;
}

const cellKey = ([r, c]: Cell) => `${r},${c}`;

/**
 * Tap the first letter of a word, then its last letter. Tapping works the same with a finger,
 * a mouse or a keyboard (each letter is a button), where dragging would not.
 */
export default function WordSearch({ pool, onWin }: Props) {
    const [round, setRound] = useState(0);
    const { grid, placed } = useMemo(() => buildWordSearch(pool, 10, 7), [pool, round]);
    const [found, setFound] = useState<string[]>([]);
    const [start, setStart] = useState<Cell | null>(null);
    const [miss, setMiss] = useState(false);

    const foundCells = useMemo(
        () => new Set(placed.filter((p) => found.includes(p.word)).flatMap((p) => p.cells.map(cellKey))),
        [placed, found]
    );
    const done = placed.length > 0 && found.length === placed.length;

    const tap = (cell: Cell) => {
        if (done) return;
        setMiss(false);
        if (!start) {
            setStart(cell);
            return;
        }
        const line = lineBetween(start, cell);
        const hit = line && matchSelection(placed, line);
        setStart(null);
        if (hit && !found.includes(hit.word)) {
            const next = [...found, hit.word];
            setFound(next);
            if (next.length === placed.length) onWin();
        } else if (cellKey(start) !== cellKey(cell)) {
            setMiss(true);
        }
    };

    const newGrid = () => {
        setRound((n) => n + 1);
        setFound([]);
        setStart(null);
        setMiss(false);
    };

    return (
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_14rem] items-start">
            <div>
                <div
                    className="grid gap-1 select-none mx-auto max-w-[28rem]"
                    style={{ gridTemplateColumns: `repeat(${grid.length}, minmax(0, 1fr))` }}
                    role="grid"
                    aria-label="Word search grid"
                >
                    {grid.map((row, r) =>
                        row.map((letter, c) => {
                            const k = `${r},${c}`;
                            const isStart = start && cellKey(start) === k;
                            const isFound = foundCells.has(k);
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    onClick={() => tap([r, c])}
                                    aria-label={`Row ${r + 1}, column ${c + 1}: ${letter}`}
                                    aria-pressed={Boolean(isStart)}
                                    className={`aspect-square rounded-md text-sm sm:text-base font-bold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
                                        isStart
                                            ? 'bg-[var(--color-accent)] text-white'
                                            : isFound
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50'
                                    }`}
                                >
                                    {letter}
                                </button>
                            );
                        })
                    )}
                </div>
                <p className="mt-3 text-center text-sm text-[var(--color-muted)]" aria-live="polite">
                    {done
                        ? 'All words found!'
                        : miss
                        ? "That's not one of the words. Try another line."
                        : start
                        ? 'Now tap the last letter of the word.'
                        : 'Tap the first letter of a word, then its last letter.'}
                </p>
            </div>

            <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-bold text-[var(--color-text)]">Find these words</h3>
                    <span className="text-xs text-[var(--color-muted)] tabular-nums">{found.length} / {placed.length}</span>
                </div>
                <ul className="grid grid-cols-2 md:grid-cols-1 gap-1.5">
                    {placed.map((p) => (
                        <li
                            key={p.word}
                            className={`text-sm font-semibold tracking-wide ${found.includes(p.word) ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-text)]'}`}
                        >
                            {p.word}
                        </li>
                    ))}
                </ul>
                <button type="button" onClick={newGrid} className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-text)] hover:border-[var(--color-primary)]/50 cursor-pointer">
                    <RotateCcw className="w-4 h-4" aria-hidden /> New grid
                </button>
            </div>
        </div>
    );
}
