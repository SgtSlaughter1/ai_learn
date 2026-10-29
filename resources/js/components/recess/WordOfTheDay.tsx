import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleHelp, Delete, Lightbulb, X } from 'lucide-react';
import { getSyncUser } from '@/services/SyncQueue';
import { DAILY_HINTS, dayNumber, wordOfTheDay } from './words';

interface Props {
    onWin: () => void;
}

const TRIES = 6;
const LENGTH = 5;
const KEYBOARD = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const HELP_SEEN_KEY = 'acedrill.wordOfTheDay.helpSeen';

type Mark = 'hit' | 'near' | 'miss';

/** Green for the right letter in the right place, amber for right letter elsewhere. */
function score(guess: string, answer: string): Mark[] {
    const marks: Mark[] = Array(LENGTH).fill('miss');
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

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** What the last guess means, in words, so the colours never have to be decoded alone. */
function explainGuess(marks: Mark[], triesLeft: number): string {
    const hits = marks.filter((m) => m === 'hit').length;
    const nears = marks.filter((m) => m === 'near').length;
    const parts = [];
    if (hits) parts.push(`${plural(hits, 'letter')} in the right spot`);
    if (nears) parts.push(`${plural(nears, 'letter')} in the word but in the wrong spot`);
    const found = parts.length ? `${parts.join(', ')}.` : 'None of those letters are in the word, so try different ones.';
    return `${found} ${triesLeft === 1 ? 'Last try.' : `${triesLeft} tries left.`}`;
}

const storageKey = () => `acedrill.wordOfTheDay.${getSyncUser() ?? 'guest'}.${dayNumber()}`;

const tile: Record<Mark, string> = {
    hit: 'bg-[var(--color-primary)] text-white border-transparent',
    near: 'bg-[var(--color-accent)] text-white border-transparent',
    miss: 'bg-[var(--color-muted)]/25 text-[var(--color-text)] border-transparent',
};

const LEGEND: { mark: Mark; letter: string; text: string; short: string }[] = [
    {
        mark: 'hit',
        letter: 'F',
        text: 'Right letter, right spot',
        short: 'Right spot',
    },
    {
        mark: 'near',
        letter: 'O',
        text: 'In the word, wrong spot',
        short: 'Wrong spot',
    },
    {
        mark: 'miss',
        letter: 'X',
        text: 'Not in the word',
        short: 'Not in the word',
    },
];

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
    const [notice, setNotice] = useState<string | null>(null);
    // Open on a first visit only where it can sit beside the board; on a phone it would push the board off screen.
    const [showHelp, setShowHelp] = useState(() => {
        try {
            return localStorage.getItem(HELP_SEEN_KEY) === null && window.matchMedia('(min-width: 768px)').matches;
        } catch {
            return false;
        }
    });
    // Revealing the clue is remembered for the day, like the guesses.
    const [hintShown, setHintShown] = useState(() => {
        try {
            return localStorage.getItem(`${storageKey()}.hint`) !== null;
        } catch {
            return false;
        }
    });
    const hint = DAILY_HINTS[answer];
    const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
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

    const revealHint = () => {
        setHintShown(true);
        try {
            localStorage.setItem(`${storageKey()}.hint`, '1');
        } catch {
            // Shown for this visit only.
        }
    };

    const closeHelp = () => {
        setShowHelp(false);
        try {
            localStorage.setItem(HELP_SEEN_KEY, '1');
        } catch {
            // Shown again next time; harmless.
        }
    };

    /** A short side-to-side shake on the row being typed, unless the learner prefers less motion. */
    const nudge = (text: string) => {
        setNotice(text);
        const row = rowRefs.current[guesses.length];
        if (row && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            row.animate(
                [
                    { transform: 'translateX(0)' },
                    { transform: 'translateX(-6px)' },
                    { transform: 'translateX(6px)' },
                    { transform: 'translateX(-4px)' },
                    { transform: 'translateX(0)' },
                ],
                { duration: 320, easing: 'ease-out' }
            );
        }
    };

    const press = useCallback(
        (key: string) => {
            if (over) return;
            setNotice(null);
            if (key === 'ENTER') {
                if (current.length !== LENGTH) {
                    nudge(`Type ${plural(LENGTH - current.length, 'more letter')} first.`);
                    return;
                }
                if (guesses.includes(current)) {
                    nudge(`You already tried ${current}. Try a different word.`);
                    return;
                }
                save([...guesses, current]);
                setCurrent('');
                if (current === answer) onWin();
            } else if (key === 'BACK') {
                setCurrent((c) => c.slice(0, -1));
            } else if (key === 'CLEAR') {
                setCurrent('');
            } else if (/^[A-Z]$/.test(key) && current.length < LENGTH) {
                setCurrent((c) => c + key);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [over, current, guesses, answer]
    );

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')) return;
            if (e.key === 'Enter') press('ENTER');
            else if (e.key === 'Backspace') press('BACK');
            else if (e.key === 'Escape') press('CLEAR');
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

    const rows = Array.from({ length: TRIES }, (_, i) => guesses[i] ?? (i === guesses.length ? current : ''));
    const lastGuess = guesses[guesses.length - 1];

    const status = won
        ? `You got it: ${answer}, in ${plural(guesses.length, 'try')}. A new word comes tomorrow.`
        : over
          ? `Today's word was ${answer}. A new word comes tomorrow.`
          : (notice ??
            (current.length === LENGTH
                ? 'Press Check to see how close you are.'
                : current.length > 0
                  ? `${plural(LENGTH - current.length, 'more letter')} to go.`
                  : lastGuess
                    ? explainGuess(score(lastGuess, answer), TRIES - guesses.length)
                    : 'Type any 5-letter word to start. The word is from your school subjects.'));

    return (
        <div className={`flex flex-col gap-4 ${showHelp ? 'md:grid md:grid-cols-[minmax(0,22rem)_18rem] md:justify-center md:items-start md:gap-8' : 'max-w-sm mx-auto w-full'}`}>
            <div className="space-y-4 min-w-0">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-[var(--color-text)] tabular-nums">
                        {over ? `${guesses.length} of ${TRIES} tries used` : `Try ${guesses.length + 1} of ${TRIES}`}
                    </p>
                    <div className="flex items-center gap-1 -mr-2">
                        {hint && !hintShown && !over && (
                            <button
                                type="button"
                                onClick={revealHint}
                                className="inline-flex items-center gap-1.5 min-h-9 px-2 rounded-lg text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 cursor-pointer"
                            >
                                <Lightbulb className="w-4 h-4" aria-hidden /> Hint
                            </button>
                        )}
                        {!showHelp && (
                            <button
                                type="button"
                                onClick={() => setShowHelp(true)}
                                className="inline-flex items-center gap-1.5 min-h-9 px-2 rounded-lg text-sm font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 cursor-pointer"
                            >
                                <CircleHelp className="w-4 h-4" aria-hidden /> How to play
                            </button>
                        )}
                    </div>
                </div>

                {/* The clue on request while playing; the meaning always once the game is over, so every day teaches the word. */}
                {hint && (hintShown || over) && (
                    <div className="flex gap-3 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 px-4 py-3" aria-live="polite">
                        <Lightbulb className="w-5 h-5 shrink-0 mt-0.5 text-[var(--color-accent)]" aria-hidden />
                        <p className="text-sm leading-snug text-[var(--color-text)]">
                            <span className="block text-xs font-bold text-[var(--color-muted)]">
                                {over ? `What ${answer} means` : 'Hint'} · {hint.subject}
                            </span>
                            {hint.clue}
                        </p>
                    </div>
                )}

                <div className="grid gap-1.5 max-w-[17rem] mx-auto" role="grid" aria-label="Your guesses">
                    {rows.map((word, r) => {
                        const marks = r < guesses.length ? score(word, answer) : null;
                        const active = !over && r === guesses.length;
                        return (
                            <div
                                key={r}
                                ref={(el) => {
                                    rowRefs.current[r] = el;
                                }}
                                className="grid grid-cols-5 gap-1.5"
                                role="row"
                                aria-current={active ? 'true' : undefined}
                            >
                                {Array.from({ length: LENGTH }, (_, c) => {
                                    const isNext = active && c === current.length;
                                    return (
                                        <div
                                            key={c}
                                            role="gridcell"
                                            aria-label={
                                                word[c]
                                                    ? `${word[c]}${marks ? `, ${marks[c] === 'hit' ? 'right spot' : marks[c] === 'near' ? 'in the word, wrong spot' : 'not in the word'}` : ''}`
                                                    : 'empty'
                                            }
                                            className={`aspect-square flex items-center justify-center rounded-lg border-2 text-xl font-extrabold transition-colors ${
                                                marks
                                                    ? tile[marks[c]]
                                                    : word[c]
                                                      ? 'border-[var(--color-primary)]/70 text-[var(--color-text)]'
                                                      : isNext
                                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                                                        : active
                                                          ? 'border-[var(--color-primary)]/30'
                                                          : 'border-[var(--color-border)] opacity-60'
                                            }`}
                                        >
                                            {word[c] ?? ''}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                {!showHelp && (
                    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-[var(--color-muted)]" aria-label="Colour key">
                        {LEGEND.map((l) => (
                            <li key={l.mark} className="inline-flex items-center gap-1.5">
                                <span className={`w-4 h-4 rounded ${tile[l.mark]}`} aria-hidden />
                                {l.short}
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex items-start justify-between gap-3 min-h-10">
                    <p className={`text-sm leading-snug ${notice ? 'font-semibold text-[var(--color-error)]' : 'text-[var(--color-text)]'}`} aria-live="polite">
                        {status}
                    </p>
                    {!over && current.length > 0 && (
                        <button
                            type="button"
                            onClick={() => press('CLEAR')}
                            className="shrink-0 min-h-9 px-3 rounded-lg border border-[var(--color-border)] text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-background)] cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {!over && (
                    <div className="space-y-1.5" aria-label="Keyboard">
                        {KEYBOARD.map((row) => (
                            <div key={row} className="flex justify-center gap-1">
                                {[...row].map((ch) => {
                                    const m = marksByLetter.get(ch);
                                    return (
                                        <button
                                            key={ch}
                                            type="button"
                                            onClick={() => press(ch)}
                                            aria-label={m ? `${ch}, ${m === 'hit' ? 'right spot' : m === 'near' ? 'in the word' : 'not in the word'}` : ch}
                                            className={`min-h-12 flex-1 min-w-0 max-w-10 rounded-lg text-sm font-bold cursor-pointer border ${
                                                m ? tile[m] : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)]'
                                            }`}
                                        >
                                            {ch}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                        {/* The two actions get their own row, so they read as actions rather than letters. */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                                type="button"
                                onClick={() => press('BACK')}
                                disabled={current.length === 0}
                                className="min-h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-default"
                            >
                                <Delete className="w-4 h-4 shrink-0" aria-hidden /> Delete
                            </button>
                            <button
                                type="button"
                                onClick={() => press('ENTER')}
                                aria-disabled={current.length !== LENGTH}
                                className={`min-h-12 rounded-lg text-sm font-bold cursor-pointer transition-opacity ${
                                    current.length === LENGTH ? 'bg-[var(--color-primary)] text-white hover:opacity-90' : 'bg-[var(--color-primary)]/40 text-white/90'
                                }`}
                            >
                                Check
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showHelp && (
                <section
                    aria-labelledby="wotd-help"
                    className="order-first md:order-none md:sticky md:top-4 relative rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 space-y-3"
                >
                    <h3 id="wotd-help" className="font-bold text-[var(--color-text)] pr-8">
                        How to play
                    </h3>
                    <button
                        type="button"
                        onClick={closeHelp}
                        aria-label="Close how to play"
                        className="absolute top-2 right-2 w-9 h-9 inline-flex items-center justify-center rounded-lg text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] cursor-pointer"
                    >
                        <X className="w-4 h-4" aria-hidden />
                    </button>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-[var(--color-text)] marker:text-[var(--color-muted)] marker:font-bold">
                        <li>Type any 5-letter word with the on-screen keys or your own keyboard.</li>
                        <li>
                            Made a mistake? <b>Delete</b> removes the last letter, <b>Clear</b> empties the row.
                        </li>
                        <li>
                            Press <b>Check</b>. The boxes change colour to show how close you are:
                        </li>
                    </ol>
                    <ul className="space-y-1.5">
                        {LEGEND.map((l) => (
                            <li key={l.mark} className="flex items-center gap-3 text-sm text-[var(--color-text)]">
                                <span className={`w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md border-2 font-extrabold ${tile[l.mark]}`} aria-hidden>
                                    {l.letter}
                                </span>
                                {l.text}
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm text-[var(--color-muted)]">The keys change colour too, so you can see which letters to use again and which to avoid. You have 6 tries.</p>
                </section>
            )}
        </div>
    );
}
