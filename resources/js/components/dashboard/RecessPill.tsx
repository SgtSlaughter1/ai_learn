import { useEffect, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Coffee } from 'lucide-react';
import { BREAK_MINUTES, isOnBreak, onRecessChange, readRecess } from '@/services/Recess';

/**
 * The way into Recess on the dashboard, in the mission card's top row: a break is the reward
 * for finishing the mission, so it sits beside the streak and shields it is earned with.
 * Phones have no room for Recess in the bottom bar, so this is their way in too.
 */
export function RecessPill() {
    const enabled = usePage<{ auth?: { user?: { recess_enabled?: boolean } | null } }>().props.auth?.user?.recess_enabled !== false;
    const [state, setState] = useState(readRecess);
    useEffect(() => onRecessChange(() => setState(readRecess())), []);

    if (!enabled) return null;

    const onBreak = isOnBreak(state);
    const ready = state.breaks > 0;
    const label = onBreak ? 'On break' : ready ? `${state.breaks} ${state.breaks === 1 ? 'break' : 'breaks'} ready` : 'Recess';
    const hint = onBreak
        ? 'Your break is running. Open Recess'
        : ready
            ? `Recess: ${label}. Play a game`
            : `Recess: finish a quiz, flashcard deck or daily review to earn ${BREAK_MINUTES} minutes. Word of the Day is free.`;

    return (
        <Link
            href="/recess"
            title={hint}
            aria-label={hint}
            className={`inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                ready || onBreak
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
                    : 'bg-[var(--color-background)] border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]'
            }`}
        >
            <Coffee className={`w-3.5 h-3.5 ${ready || onBreak ? '' : 'text-[var(--color-primary)]'}`} aria-hidden />
            <span className={ready || onBreak ? '' : 'hidden sm:inline'}>{label}</span>
        </Link>
    );
}
