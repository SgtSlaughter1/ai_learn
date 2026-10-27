import { getSyncUser } from './SyncQueue';

/**
 * Recess: short game breaks a learner earns by learning.
 *
 * Finishing a quiz, a flashcard deck or the daily review earns one break (up to MAX_BREAKS
 * saved). Starting one spends it and runs a BREAK_MINUTES countdown that keeps going even if
 * the learner leaves the page. Everything lives on the device, per signed-in learner, so it
 * works offline; the server only pays the small capped XP for a win.
 */

export const BREAK_MINUTES = 10;
export const MAX_BREAKS = 3;

export type RecessSource = 'quiz' | 'flashcards' | 'revision';

export interface RecessState {
    /** Breaks earned and not yet used. */
    breaks: number;
    /** When the running break ends (ms since epoch), or null when none is running. */
    endsAt: number | null;
}

const EMPTY: RecessState = { breaks: 0, endsAt: null };
const CHANGED = 'acedrill:recess-changed';

const key = () => `acedrill.recess.${getSyncUser() ?? 'guest'}`;

export function readRecess(): RecessState {
    try {
        const raw = localStorage.getItem(key());
        if (!raw) return EMPTY;
        const parsed = JSON.parse(raw) as Partial<RecessState>;
        return {
            breaks: Math.max(0, Math.min(MAX_BREAKS, Number(parsed.breaks) || 0)),
            endsAt: typeof parsed.endsAt === 'number' ? parsed.endsAt : null,
        };
    } catch {
        return EMPTY;
    }
}

function write(state: RecessState): void {
    try {
        localStorage.setItem(key(), JSON.stringify(state));
    } catch {
        // Storage unavailable (private window): recess just isn't remembered.
    }
    window.dispatchEvent(new Event(CHANGED));
}

/** Call when a learning activity finishes. Signed-out visitors earn nothing. */
export function earnRecess(_source: RecessSource): void {
    if (!getSyncUser()) return;
    const state = readRecess();
    write({ ...state, breaks: Math.min(MAX_BREAKS, state.breaks + 1) });
}

export function isOnBreak(state: RecessState, now = Date.now()): boolean {
    return state.endsAt !== null && state.endsAt > now;
}

/** Spend one earned break and start the countdown. Returns false when none is available. */
export function startBreak(now = Date.now()): boolean {
    const state = readRecess();
    if (isOnBreak(state, now)) return true;
    if (state.breaks < 1) return false;
    write({ breaks: state.breaks - 1, endsAt: now + BREAK_MINUTES * 60_000 });
    return true;
}

/** Clear a finished break so the page goes back to its locked or ready state. */
export function finishBreak(): void {
    write({ ...readRecess(), endsAt: null });
}

/** Re-render on changes from this tab (earn, start) and from other tabs. */
export function onRecessChange(listener: () => void): () => void {
    const onStorage = (e: StorageEvent) => {
        if (e.key === key()) listener();
    };
    window.addEventListener(CHANGED, listener);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGED, listener);
        window.removeEventListener('storage', onStorage);
    };
}

/** A short two-tone school bell from the Web Audio API: no sound file to download or cache. */
export function ringBell(): void {
    try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        [0, 0.35, 0.7].forEach((offset, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = i % 2 === 0 ? 880 : 660;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
            gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.3);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + offset);
            osc.stop(ctx.currentTime + offset + 0.32);
        });
        setTimeout(() => ctx.close().catch(() => {}), 1500);
    } catch {
        // No audio available; the on-screen message still appears.
    }
}
