import { describe, expect, it } from 'vitest';
import { answerHash, findCorrectOptionId, isCorrectOption, openExplanation, reviewAnswer } from '../AnswerKey';

// Produced by app/Support/OfflineAnswerKey.php for past question 42 whose correct option is 7,
// so these tests prove the device reads exactly what the server writes.
const PHP_HASH = '479d64f372630c6d23246e5f767fc7bea2b0735cf5fcad9bbe1bc87cd7f75c78';
const PHP_SEALED = 'hjCpinRVBPYu8lXRn71hScwQglRkeECPPzbY6GBpMqZ72nEmWyu83V0D9K3vQA==';

const question = { id: 42, answer_hash: PHP_HASH, explanation_sealed: PHP_SEALED, options: [{ id: 5 }, { id: 6 }, { id: 7 }, { id: 8 }] };

describe('AnswerKey', () => {
    it('hashes options exactly like the server', async () => {
        expect(await answerHash('pq', 42, 7)).toBe(PHP_HASH);
    });

    it('checks an answer against the hash', async () => {
        expect(await isCorrectOption('pq', 42, 7, PHP_HASH)).toBe(true);
        expect(await isCorrectOption('pq', 42, 6, PHP_HASH)).toBe(false);
        expect(await isCorrectOption('q', 42, 7, PHP_HASH)).toBe(false); // quiz and CBT ids don't collide
        expect(await isCorrectOption('pq', 42, null, PHP_HASH)).toBe(false);
    });

    it('finds the correct option and opens the server-sealed explanation', async () => {
        expect(await findCorrectOptionId('pq', 42, [5, 6, 7, 8], PHP_HASH)).toBe(7);
        expect(await openExplanation('pq', 42, 7, PHP_SEALED)).toBe('Because 2 + 2 = 4.');
    });

    it('cannot open the explanation with a wrong option', async () => {
        expect(await openExplanation('pq', 42, 6, PHP_SEALED)).toBeNull();
    });

    it('reviews a wrong answer with the correct option and explanation', async () => {
        expect(await reviewAnswer('pq', question, 5)).toEqual({ isCorrect: false, correctOptionId: 7, explanation: 'Because 2 + 2 = 4.' });
        expect((await reviewAnswer('pq', question, 7)).isCorrect).toBe(true);
    });
});
