/**
 * Which questions make up one attempt. Questions about the same passage (context_id)
 * are one unit: an attempt takes all of them or none, in their context_order, so a
 * learner never gets question 3 about a passage without questions 1 and 2.
 *
 * Mirrors app/Support/AttemptQuestions.php, which grades (and pads) attempts the same way.
 */

export interface PassageLinked {
    id: number;
    context_id?: number | null;
    context_order?: number | null;
}

export const QUESTIONS_PER_ATTEMPT = 10;

/** Group questions into units, keeping the order each unit first appears in. */
export function attemptUnits<T extends PassageLinked>(questions: T[]): T[][] {
    const units = new Map<string, T[]>();
    for (const question of questions) {
        const key = question.context_id ? `c${question.context_id}` : `q${question.id}`;
        const unit = units.get(key);
        if (unit) unit.push(question);
        else units.set(key, [question]);
    }
    return [...units.values()].map((unit) =>
        [...unit].sort((a, b) => (a.context_order ?? Number.MAX_SAFE_INTEGER) - (b.context_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id),
    );
}

/**
 * Take whole units until there are at least `limit` questions (the last unit may take it a
 * little over, never under), shuffled unless `shuffle` is false, then flatten.
 */
export function pickAttemptQuestions<T extends PassageLinked>(
    questions: T[],
    limit: number = QUESTIONS_PER_ATTEMPT,
    shuffle: boolean = true,
    random: () => number = Math.random,
): T[] {
    const units = attemptUnits(questions);
    if (shuffle) {
        for (let i = units.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [units[i], units[j]] = [units[j], units[i]];
        }
    }
    const picked: T[] = [];
    for (const unit of units) {
        if (picked.length >= limit) break;
        picked.push(...unit);
    }
    return picked;
}

/** Runs of consecutive questions on the same passage: [startIndex, endIndex, contextId]. */
export function passageRuns<T extends PassageLinked>(questions: T[]): { start: number; end: number; contextId: number }[] {
    const runs: { start: number; end: number; contextId: number }[] = [];
    questions.forEach((q, i) => {
        if (!q.context_id) return;
        const last = runs[runs.length - 1];
        if (last && last.contextId === q.context_id && last.end === i - 1) last.end = i;
        else runs.push({ start: i, end: i, contextId: q.context_id });
    });
    return runs;
}
