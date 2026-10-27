import { describe, expect, it } from 'vitest';
import {
    applyOp, botMove, buildWordSearch, canMake, drop, emptyBoard, frac, isTarget, lineBetween,
    make24Puzzle, matchSelection, winningLine, type Board,
} from '../logic';
import { DAILY_WORDS, wordOfTheDay, wordsForSubjects } from '../words';

/** A small repeatable random generator. */
function seeded(seed: number) {
    return () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };
}

describe('word search', () => {
    it('places words on straight lines and finds them from either end', () => {
        const { grid, placed } = buildWordSearch(['CELL', 'NUCLEUS', 'ENZYME', 'GENE'], 10, 4, seeded(7));
        expect(placed.length).toBeGreaterThan(0);
        for (const p of placed) {
            expect(p.cells.map(([r, c]) => grid[r][c]).join('')).toBe(p.word);
            const first = p.cells[0];
            const last = p.cells[p.cells.length - 1];
            expect(matchSelection(placed, lineBetween(first, last)!)).toBe(p);
            expect(matchSelection(placed, lineBetween(last, first)!)).toBe(p);
        }
        expect(grid.flat().every((ch) => /^[A-Z]$/.test(ch))).toBe(true);
    });

    it('ignores selections that are not straight lines', () => {
        expect(lineBetween([0, 0], [1, 2])).toBeNull();
    });

    it('builds word lists from the learner\'s subjects', () => {
        expect(wordsForSubjects(['Chemistry'])).toContain('CATALYST');
        expect(wordsForSubjects(['Basket weaving'])).toContain('STUDY');
    });
});

describe('make 24', () => {
    it('keeps fractions exact, so 8 ÷ (3 − 8 ÷ 3) is 24', () => {
        const inner = applyOp(frac(3), '−', applyOp(frac(8), '÷', frac(3))!)!;
        expect(isTarget(applyOp(frac(8), '÷', inner)!)).toBe(true);
        expect(applyOp(frac(1), '÷', frac(0))).toBeNull();
    });

    it('knows solvable from unsolvable sets', () => {
        expect(canMake([3, 3, 8, 8].map((n) => frac(n)))).toBe(true);
        expect(canMake([1, 1, 1, 1].map((n) => frac(n)))).toBe(false);
    });

    it('only serves puzzles that have an answer', () => {
        const rand = seeded(42);
        for (let i = 0; i < 20; i++) {
            expect(canMake(make24Puzzle(rand).map((n) => frac(n)))).toBe(true);
        }
    });
});

describe('connect four', () => {
    const play = (moves: number[]): Board =>
        moves.reduce<Board>((b, col, i) => drop(b, col, (i % 2 === 0 ? 1 : 2) as 1 | 2)!, emptyBoard());

    it('spots four in a row', () => {
        expect(winningLine(play([0, 6, 1, 6, 2, 6, 3]))).not.toBeNull();
        expect(winningLine(play([0, 1, 2]))).toBeNull();
    });

    it('the bot takes a win and blocks one', () => {
        // Bot (2) has three stacked in column 6: it should finish there.
        expect(botMove(play([0, 6, 1, 6, 0, 6]), 2, seeded(1))).toBe(6);
        // Human (1) has three in a row on the bottom: the bot blocks column 3.
        expect(botMove(play([0, 6, 1, 6, 2]), 2, seeded(1))).toBe(3);
    });
});

describe('word of the day', () => {
    it('is the same five-letter word all day and changes the next day', () => {
        expect(DAILY_WORDS.every((w) => /^[A-Z]{5}$/.test(w))).toBe(true);
        const morning = new Date(2026, 9, 27, 7);
        const evening = new Date(2026, 9, 27, 22);
        expect(wordOfTheDay(morning)).toBe(wordOfTheDay(evening));
        expect(wordOfTheDay(new Date(2026, 9, 28, 7))).not.toBe(wordOfTheDay(morning));
    });
});
