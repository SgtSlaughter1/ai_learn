import { describe, expect, it } from 'vitest';
import { DAILY_HINTS, DAILY_WORDS } from '../words';

describe('Word of the Day hints', () => {
    it('has a clue for every daily word', () => {
        expect(DAILY_WORDS.filter((w) => !DAILY_HINTS[w])).toEqual([]);
    });

    it('never gives the word away in its clue', () => {
        // The singular counts too: "CELL" in the clue would give away CELLS.
        const leaks = DAILY_WORDS.filter((w) => DAILY_HINTS[w]?.clue.toUpperCase().includes(w.replace(/S$/, '')));
        expect(leaks).toEqual([]);
    });
});
