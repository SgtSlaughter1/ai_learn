import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';

// Recess keeps its state in localStorage and announces changes on window; the test runner
// has neither, so give it small in-memory ones. (Imports run first, but none of these
// modules touches storage until a test calls them.)
const store = new Map<string, string>();
Object.assign(globalThis, {
    localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => [...store.keys()][i] ?? null,
        get length() { return store.size; },
    },
});
const events = new EventTarget();
if (typeof window === 'undefined') {
    Object.assign(globalThis, {
        window: Object.assign(globalThis, {
            dispatchEvent: (e: Event) => events.dispatchEvent(e),
            addEventListener: (t: string, l: EventListener) => events.addEventListener(t, l),
            removeEventListener: (t: string, l: EventListener) => events.removeEventListener(t, l),
        }),
    });
}
import { db } from '../../db/database';
import { cacheFlashcards } from '../OfflineService';
import { setSyncUser } from '../SyncQueue';
import { BREAK_MINUTES, MAX_BREAKS, earnRecess, finishBreak, isOnBreak, readRecess, startBreak } from '../Recess';

beforeEach(() => {
    localStorage.clear();
    setSyncUser('learner-a');
});

describe('recess breaks', () => {
    it('are earned by learning, saved up to a limit, and spent one at a time', () => {
        expect(startBreak()).toBe(false);

        for (let i = 0; i < MAX_BREAKS + 2; i++) earnRecess('quiz');
        expect(readRecess().breaks).toBe(MAX_BREAKS);

        const now = Date.now();
        expect(startBreak(now)).toBe(true);
        const state = readRecess();
        expect(state.breaks).toBe(MAX_BREAKS - 1);
        expect(state.endsAt).toBe(now + BREAK_MINUTES * 60_000);
        expect(isOnBreak(state, now + 60_000)).toBe(true);
        expect(isOnBreak(state, now + BREAK_MINUTES * 60_000 + 1)).toBe(false);

        finishBreak();
        expect(readRecess().endsAt).toBeNull();
    });

    it('belong to the learner who earned them on a shared device', () => {
        earnRecess('flashcards');
        setSyncUser('learner-b');
        expect(readRecess().breaks).toBe(0);
        setSyncUser('learner-a');
        expect(readRecess().breaks).toBe(1);
    });
});

describe('flashcard cache', () => {
    it("replaces yesterday's deck instead of piling decks up", async () => {
        const card = (id: number) => ({ id, front: `Q${id}`, back: `A${id}` }) as any;
        await cacheFlashcards([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(card));
        await cacheFlashcards([11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(card));

        const ids = (await db.flashcards.toArray()).map((c) => c.id).sort((a, b) => a - b);
        expect(ids).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
    });
});
