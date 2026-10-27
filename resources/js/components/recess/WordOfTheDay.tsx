import { useCallback, useEffect, useState } from 'react';
import { Delete } from 'lucide-react';
import { getSyncUser } from '@/services/SyncQueue';
import { dayNumber, wordOfTheDay } from './words';

interface Props {
    onWin: () => void;
}

const TRIES = 6;
const KEYBOARD = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

type Mark = 'hit' | 'near' | 'miss';

/** Green for the right letter in the right place, amber for right letter elsewhere. */
function score(guess: string, answer: string): Mark[] {
    const marks: Mark[] = Array(5).fill('miss');
    const left = [...answer];
    [...guess].forEach((ch, i) => {
        if (answer[i] === ch) {
            marks[i] = 'hit';
            left[i] = '';
        }
    });
    [...guess].forEach((ch, i) => {
        if (marks[i] === 'hit') return;
        const j = left.indexOf(ch);
        if (j !== -1) {
            marks[i] = 'near';
            left[j] = '';
        }
    });
    return marks;
}

const storageKey = () => `acedrill.wordOfTheDay.${getSyncUser() ?? 'guest'}.${dayNumber()}`;

/** One five-letter curriculum word a day, six tries; today's game is remembered on the device. */
export default function WordOfTheDay({ onWin }: Props) {
    const answer = wordOfTheDay();
    const [guesses, setGuesses] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem(storageKey()) ?? '[]');
        } catch {
            return [];
        }
    });
    const [current, setCurrent] = useState('');
    const won = guesses.includes(answer);
    const over = won || guesses.length >= TRIES;

    const save = (next: string[]) => {
        setGuesses(next);
        try {
            localStorage.setItem(storageKey(), JSON.stringify(next));
        } catch {
            // Not remembered; today's game still plays.
        }
    };

    const press = useCallback(
        (key: string) => {
            if (over) return;
            if (key === 'ENTER') {
                if (current.length !== 5) return;
                const next = [...guesses, current];
                save(next);
                setCurrent('');
                if (current === answer) onWin();
            } else if (key === 'BACK') {
                setCurrent((c) => c.slice(0, -1));
            } else if (/^[A-Z]$/.test(key) && current.length < 5) {
                setCurrent((c) => c + key);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [over, current, guesses, answer]
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key === 'Enter') press('ENTER');
            else if (e.key === 'Backspace') press('BACK');
            else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [press]);

    const marksByLetter = new Map<string, Mark>();
    guesses.forEach((g) =>
        score(g, answer).forEach((m, i) => {
            const prev = marksByLetter.get(g[i]);
            if (prev !== 'hit' && (m === 'hit' || prev !== 'near')) marksByLetter.set(g[i], m);
        })
    );

    const tile: Record<Mark, string> = {
        hit: 'bg-[var(--color-primary)] text-white border-transparent',
        near: 'bg-[var(--color-accent)] text-white border-transparent',
        miss: 'bg-[var(--color-muted)]/25 text-[var(--color-text)] border-transparent',
    };

    const rows = Array.from({ length: TRIES }, (_, i) => guesses[i] ?? (i === guesses.length ? current : ''));

    return (
        <div className="max-w-xs mx-auto space-y-5">
            <div className="grid gap-1.5" role="grid" aria-label="Your guesses">
                {rows.map((word, r) => {
                    const marks = r < guesses.length ? score(word, answer) : null;
                    return (
                        <div key={r} className="grid grid-cols-5 gap-1.5" role="row">
                            {Array.from({ length: 5 }, (_, c) => (
                                <div
                                    key={c}
                                    role="gridcell"
                                    aria-label={word[c] ? `${word[c]}${marks ? `, ${marks[c] === 'hit' ? 'right place' : marks[c] === 'near' ? 'in the word' : 'not in the word'}` : ''}` : 'empty'}
                                    className={`aspect-square flex items-center justify-center rounded-lg border-2 text-xl font-extrabold ${
                                        marks ? tile[marks[c]] : word[c] ? 'border-[var(--color-primary)]/60 text-[var(--color-text)]' : 'border-[var(--color-border)]'
                                    }`}
                                >
                                    {word[c] ?? ''}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            <p className="text-center text-sm text-[var(--color-muted)] min-h-5" aria-live="polite">
                {won
                    ? `Got it: ${answer}. A new word comes tomorrow.`
                    : over
                    ? `Today's word was ${answer}. Try again tomorrow.`
                    : 'Guess the 5-letter subject word. Green: right place. Amber: in the word.'}
            </p>

            {!over && (
                <div className="space-y-1.5" aria-label="Keyboard">
                    {KEYBOARD.map((row, i) => (
                        <div key={row} className="flex justify-center gap-1">
                            {i === 2 && (
                                <button type="button" onClick={() => press('ENTER')} className="min-h-12 px-2 shrink-0 rounded-lg bg-[var(--color-primary)] text-white text-xs font-bold cursor-pointer">
                                    Enter
                                </button>
                            )}
                            {[...row].map((ch) => {
                                const m = marksByLetter.get(ch);
                                return (
                                    <button
                                        key={ch}
                                        type="button"
                                        onClick={() => press(ch)}
                                        className={`min-h-12 flex-1 min-w-0 max-w-9 rounded-lg text-sm font-bold cursor-pointer border ${
                                            m ? tile[m] : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]'
                                        }`}
                                    >
                                        {ch}
                                    </button>
                                );
                            })}
                            {i === 2 && (
                                <button type="button" onClick={() => press('BACK')} aria-label="Delete letter" className="min-h-12 px-2 shrink-0 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] cursor-pointer">
                                    <Delete className="w-4 h-4" aria-hidden />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
