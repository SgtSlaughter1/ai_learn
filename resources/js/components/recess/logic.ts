/**
 * Rules for the Recess games, kept apart from the screens so they can be tested.
 * Every function takes its randomness as an argument for repeatable tests.
 */

export type Rand = () => number;

// ── Word Search ─────────────────────────────────────────────────────────────

export type Cell = [row: number, col: number];

export interface PlacedWord {
    word: string;
    cells: Cell[];
}

/** Right, down, down-right and up-right: always readable left to right or top to bottom. */
const DIRECTIONS: Cell[] = [[0, 1], [1, 0], [1, 1], [-1, 1]];

export function buildWordSearch(pool: string[], size = 10, count = 7, rand: Rand = Math.random): { grid: string[][]; placed: PlacedWord[] } {
    const grid: string[][] = Array.from({ length: size }, () => Array(size).fill(''));
    const placed: PlacedWord[] = [];
    const candidates = shuffle(pool.filter((w) => w.length >= 3 && w.length <= size), rand);

    for (const word of candidates) {
        if (placed.length >= count) break;
        for (let attempt = 0; attempt < 100; attempt++) {
            const [dr, dc] = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)];
            const row = Math.floor(rand() * size);
            const col = Math.floor(rand() * size);
            const cells: Cell[] = [...word].map((_, i) => [row + dr * i, col + dc * i]);
            const fits = cells.every(([r, c], i) => r >= 0 && r < size && c >= 0 && c < size && (grid[r][c] === '' || grid[r][c] === word[i]));
            if (!fits) continue;
            cells.forEach(([r, c], i) => (grid[r][c] = word[i]));
            placed.push({ word, cells });
            break;
        }
    }

    const letters = 'ABCDEFGHIJKLMNOPRSTUVWY';
    for (const row of grid) {
        for (let c = 0; c < size; c++) {
            if (row[c] === '') row[c] = letters[Math.floor(rand() * letters.length)];
        }
    }
    return { grid, placed };
}

/** Cells on the straight line from a to b (inclusive), or null when a and b aren't in a line. */
export function lineBetween(a: Cell, b: Cell): Cell[] | null {
    const dr = b[0] - a[0];
    const dc = b[1] - a[1];
    if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));
    const sr = Math.sign(dr);
    const sc = Math.sign(dc);
    return Array.from({ length: steps + 1 }, (_, i) => [a[0] + sr * i, a[1] + sc * i] as Cell);
}

/** The placed word a selection spells (either direction), if any. */
export function matchSelection(placed: PlacedWord[], selection: Cell[]): PlacedWord | null {
    const key = (cells: Cell[]) => cells.map(([r, c]) => `${r},${c}`).join('|');
    const forward = key(selection);
    const backward = key([...selection].reverse());
    return placed.find((p) => key(p.cells) === forward || key(p.cells) === backward) ?? null;
}

// ── Make 24 ─────────────────────────────────────────────────────────────────

/** An exact fraction, so 8 ÷ 3 stays 8/3 and 8 ÷ (3 − 8 ÷ 3) is exactly 24. */
export interface Fraction {
    n: number;
    d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export function frac(n: number, d = 1): Fraction {
    const sign = d < 0 ? -1 : 1;
    const g = gcd(n, d) || 1;
    return { n: (sign * n) / g, d: (sign * d) / g };
}

export type Op = '+' | '−' | '×' | '÷';

export function applyOp(a: Fraction, op: Op, b: Fraction): Fraction | null {
    switch (op) {
        case '+': return frac(a.n * b.d + b.n * a.d, a.d * b.d);
        case '−': return frac(a.n * b.d - b.n * a.d, a.d * b.d);
        case '×': return frac(a.n * b.n, a.d * b.d);
        case '÷': return b.n === 0 ? null : frac(a.n * b.d, a.d * b.n);
    }
}

export const isTarget = (f: Fraction, target = 24) => f.d === 1 && f.n === target;

export function formatFraction(f: Fraction): string {
    return f.d === 1 ? String(f.n) : `${f.n}/${f.d}`;
}

/** Whether these numbers can make the target using each once with + − × ÷. */
export function canMake(values: Fraction[], target = 24): boolean {
    if (values.length === 1) return isTarget(values[0], target);
    for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < values.length; j++) {
            if (i === j) continue;
            const rest = values.filter((_, k) => k !== i && k !== j);
            for (const op of ['+', '−', '×', '÷'] as Op[]) {
                const r = applyOp(values[i], op, values[j]);
                if (r && canMake([...rest, r], target)) return true;
            }
        }
    }
    return false;
}

/** Four numbers from 1 to 9 that can make 24 (never an unsolvable puzzle). */
export function make24Puzzle(rand: Rand = Math.random): number[] {
    for (;;) {
        const nums = Array.from({ length: 4 }, () => 1 + Math.floor(rand() * 9));
        if (canMake(nums.map((n) => frac(n)))) return nums;
    }
}

// ── Connect Four ────────────────────────────────────────────────────────────

export const ROWS = 6;
export const COLS = 7;
export type Disc = 0 | 1 | 2;
export type Board = Disc[][];

export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(0));

/** Drop a disc; returns the new board, or null when the column is full. */
export function drop(board: Board, col: number, player: 1 | 2): Board | null {
    for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][col] === 0) {
            const next = board.map((row) => [...row]);
            next[r][col] = player;
            return next;
        }
    }
    return null;
}

/** The four winning cells, or null. */
export function winningLine(board: Board): Cell[] | null {
    const dirs: Cell[] = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const p = board[r][c];
            if (!p) continue;
            for (const [dr, dc] of dirs) {
                const cells: Cell[] = [0, 1, 2, 3].map((i) => [r + dr * i, c + dc * i]);
                if (cells.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === p)) return cells;
            }
        }
    }
    return null;
}

export const isFull = (board: Board) => board[0].every((d) => d !== 0);

/**
 * A friendly opponent: takes a win, blocks a win, avoids handing one over, and otherwise
 * prefers the middle. Beatable, so a 10-minute break still has a few wins in it.
 */
export function botMove(board: Board, bot: 1 | 2 = 2, rand: Rand = Math.random): number {
    const human: 1 | 2 = bot === 1 ? 2 : 1;
    const open = [...Array(COLS).keys()].filter((c) => board[0][c] === 0);
    const wins = (b: Board | null) => b !== null && winningLine(b) !== null;

    const winning = open.find((c) => wins(drop(board, c, bot)));
    if (winning !== undefined) return winning;
    const blocking = open.find((c) => wins(drop(board, c, human)));
    if (blocking !== undefined) return blocking;

    const safe = open.filter((c) => {
        const after = drop(board, c, bot)!;
        return !open.some((h) => wins(drop(after, h, human)));
    });
    const choices = safe.length > 0 ? safe : open;
    const centreFirst = [3, 2, 4, 1, 5, 0, 6].filter((c) => choices.includes(c));
    // Mostly the most central safe column, sometimes the next one along.
    return centreFirst[rand() < 0.75 || centreFirst.length === 1 ? 0 : 1];
}

// ── Shared ──────────────────────────────────────────────────────────────────

export function shuffle<T>(items: T[], rand: Rand = Math.random): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
