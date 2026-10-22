import { describe, expect, it } from 'vitest';
import { attemptUnits, passageRuns, pickAttemptQuestions } from '../AttemptQuestions';

const single = (id: number) => ({ id, context_id: null, context_order: null });
const onPassage = (id: number, context_id: number, context_order: number) => ({ id, context_id, context_order });

describe('AttemptQuestions', () => {
    // A passage with 5 questions (stored out of order) and 8 single questions.
    const bank = [
        single(1), onPassage(10, 7, 3), single(2), onPassage(11, 7, 1), single(3), single(4),
        onPassage(12, 7, 5), single(5), onPassage(13, 7, 2), single(6), onPassage(14, 7, 4), single(7), single(8),
    ];

    it('groups a passage into one unit, in context_order', () => {
        const units = attemptUnits(bank);
        expect(units).toHaveLength(9);
        expect(units[1].map((q) => q.id)).toEqual([11, 13, 10, 14, 12]);
    });

    it('takes a passage whole and in order, however the units are shuffled', () => {
        for (let seed = 0; seed < 50; seed++) {
            let x = seed + 1;
            const random = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
            const picked = pickAttemptQuestions(bank, 10, true, random);
            expect(picked.length).toBeGreaterThanOrEqual(10);
            const ids = picked.map((q) => q.id);
            const first = ids.indexOf(11);
            if (first === -1) {
                expect(ids.some((id) => id >= 10)).toBe(false); // none of the passage
            } else {
                expect(ids.slice(first, first + 5)).toEqual([11, 13, 10, 14, 12]); // all, together
            }
        }
    });

    it('never goes under the limit and only over it by the last passage', () => {
        const picked = pickAttemptQuestions(bank, 10, false);
        // 1, the passage (5), 2, 3, 4, 5 = 10
        expect(picked.map((q) => q.id)).toEqual([1, 11, 13, 10, 14, 12, 2, 3, 4, 5]);
    });

    it('returns everything for a small quiz', () => {
        expect(pickAttemptQuestions(bank.slice(0, 3), 10)).toHaveLength(3);
    });

    it('finds the runs of questions on the same passage', () => {
        const picked = pickAttemptQuestions(bank, 10, false);
        expect(passageRuns(picked)).toEqual([{ start: 1, end: 5, contextId: 7 }]);
    });
});
