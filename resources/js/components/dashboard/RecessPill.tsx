import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { Coffee } from 'lucide-react';
import { BREAK_MINUTES, isOnBreak, onRecessChange, readRecess } from '@/services/Recess';

/** The way into Recess on the dashboard (phones have no room for it in the bottom bar). */
export function DashboardRecessCard() {
    const [state, setState] = useState(readRecess);
    useEffect(() => onRecessChange(() => setState(readRecess())), []);

    const onBreak = isOnBreak(state);
    const ready = state.breaks > 0;

    return (
        <Link
            href="/recess"
            className="flex items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3.5 hover:border-[var(--color-primary)]/50 transition-colors"
        >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ready || onBreak ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-primary-10)] text-[var(--color-primary)]'}`}>
                <Coffee className="w-5 h-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[var(--color-text)]">
                    {onBreak ? 'Your break is running' : ready ? `Recess: ${state.breaks} ${state.breaks === 1 ? 'break' : 'breaks'} ready` : 'Recess'}
                </span>
                <span className="block text-xs text-[var(--color-muted)]">
                    {onBreak || ready
                        ? 'Word Search, Make 24, Connect 4 and more'
                        : `Finish a quiz, flashcard deck or daily review to earn ${BREAK_MINUTES} minutes. Word of the Day is free.`}
                </span>
            </span>
            <span className="text-sm font-bold text-[var(--color-primary)] shrink-0">{onBreak ? 'Back to it' : ready ? 'Play' : 'Open'}</span>
        </Link>
    );
}
