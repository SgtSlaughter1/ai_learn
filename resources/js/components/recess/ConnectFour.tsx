import { useEffect, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { botMove, COLS, drop, emptyBoard, isFull, winningLine, type Board } from './logic';

interface Props {
    /** Called when the learner beats the computer (a two-player game earns no XP). */
    onWin: () => void;
}

type Mode = 'bot' | 'friend';

/** Four in a row, against a friendly computer or a friend sharing the device. */
export default function ConnectFour({ onWin }: Props) {
    const [mode, setMode] = useState<Mode>('bot');
    const [board, setBoard] = useState<Board>(emptyBoard);
    const [turn, setTurn] = useState<1 | 2>(1);
    const line = useMemo(() => winningLine(board), [board]);
    const winner = line ? board[line[0][0]][line[0][1]] : 0;
    const draw = !line && isFull(board);
    const over = Boolean(line) || draw;
    const botThinking = mode === 'bot' && turn === 2 && !over;

    const play = (col: number) => {
        if (over) return;
        const next = drop(board, col, turn);
        if (!next) return;
        setBoard(next);
        setTurn(turn === 1 ? 2 : 1);
        if (mode === 'bot' && turn === 1 && winningLine(next)) onWin();
    };

    useEffect(() => {
        if (!botThinking) return;
        const t = setTimeout(() => play(botMove(board, 2)), 450);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [botThinking, board]);

    const restart = (nextMode: Mode = mode) => {
        setMode(nextMode);
        setBoard(emptyBoard());
        setTurn(1);
    };

    const winCells = new Set(line?.map(([r, c]) => `${r},${c}`));
    const names = mode === 'bot' ? { 1: 'You', 2: 'Computer' } : { 1: 'Green', 2: 'Amber' };
    const status = winner
        ? mode === 'bot' ? (winner === 1 ? 'You win!' : 'The computer wins this one.') : `${names[winner as 1 | 2]} wins!`
        : draw
        ? "It's a draw."
        : botThinking
        ? 'Computer is thinking…'
        : mode === 'bot' ? 'Your turn: tap a column.' : `${names[turn]}'s turn.`;

    const disc = (d: number) =>
        d === 1 ? 'bg-[var(--color-primary)]' : d === 2 ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-background)]';

    return (
        <div className="max-w-md mx-auto space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="inline-flex p-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)]" role="group" aria-label="Opponent">
                    {(['bot', 'friend'] as Mode[]).map((m) => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => restart(m)}
                            aria-pressed={mode === m}
                            className={`min-h-9 px-3 rounded-lg text-xs font-bold cursor-pointer ${mode === m ? 'bg-[var(--color-surface)] text-[var(--color-primary)] border border-[var(--color-border)]' : 'text-[var(--color-muted)]'}`}
                        >
                            {m === 'bot' ? 'vs Computer' : 'vs a friend'}
                        </button>
                    ))}
                </div>
                <button type="button" onClick={() => restart()} className="inline-flex items-center gap-1.5 min-h-11 sm:min-h-9 px-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-bold text-[var(--color-text)] cursor-pointer">
                    <RotateCcw className="w-4 h-4" aria-hidden /> New game
                </button>
            </div>

            <div className="rounded-2xl bg-[var(--color-primary)]/15 p-2 sm:p-3">
                <div className="grid gap-1.5 sm:gap-2" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
                    {Array.from({ length: COLS }, (_, c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => play(c)}
                            disabled={over || botThinking || board[0][c] !== 0}
                            aria-label={`Drop in column ${c + 1}`}
                            className="grid gap-1.5 sm:gap-2 rounded-xl p-0.5 cursor-pointer disabled:cursor-default enabled:hover:bg-[var(--color-primary)]/10 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                        >
                            {board.map((row, r) => (
                                <span
                                    key={r}
                                    className={`block aspect-square rounded-full ${disc(row[c])} ${winCells.has(`${r},${c}`) ? 'ring-4 ring-[var(--color-text)]/70' : ''}`}
                                />
                            ))}
                        </button>
                    ))}
                </div>
            </div>

            <p className="text-center text-sm font-semibold text-[var(--color-text)]" aria-live="polite">{status}</p>
        </div>
    );
}
