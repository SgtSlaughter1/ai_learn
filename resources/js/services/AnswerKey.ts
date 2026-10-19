/**
 * Offline grading without readable answers on the device (mirrors app/Support/OfflineAnswerKey.php).
 * Each question carries `answer_hash` (a hash of its correct option) and `explanation_sealed`
 * (its explanation, encrypted with a key derived from the correct option). After the learner
 * submits, the device finds the correct option by testing each one against the hash, which
 * also unlocks the explanation. Nothing readable is stored; the server still re-grades.
 */

export type AnswerScope = 'q' | 'pq'; // quiz questions | past (CBT) questions

const encoder = new TextEncoder();

async function sha256(text: string): Promise<ArrayBuffer> {
    return crypto.subtle.digest('SHA-256', encoder.encode(text));
}

function toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function answerHash(scope: AnswerScope, questionId: number, optionId: number): Promise<string> {
    return toHex(await sha256(`acedrill_salt_${scope}_${questionId}_opt_${optionId}`));
}

/** Whether optionId is the correct answer. False when it can't be checked (no hash, no WebCrypto). */
export async function isCorrectOption(
    scope: AnswerScope,
    questionId: number,
    optionId: number | null | undefined,
    hash: string | null | undefined,
): Promise<boolean> {
    if (!hash || !optionId) return false;
    try {
        return (await answerHash(scope, questionId, optionId)) === hash;
    } catch {
        return false; // crypto.subtle needs HTTPS or localhost
    }
}

/** The correct option's id, or null when the question has no answer hash. */
export async function findCorrectOptionId(
    scope: AnswerScope,
    questionId: number,
    optionIds: number[],
    hash: string | null | undefined,
): Promise<number | null> {
    for (const id of optionIds) {
        if (await isCorrectOption(scope, questionId, id, hash)) return id;
    }
    return null;
}

/** Decrypt an explanation sealed for this question's correct option; null if it can't be opened. */
export async function openExplanation(
    scope: AnswerScope,
    questionId: number,
    correctOptionId: number | null,
    sealed: string | null | undefined,
): Promise<string | null> {
    if (!sealed || !correctOptionId) return null;
    try {
        const bytes = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
        const keyBytes = await sha256(`acedrill_exp_${scope}_${questionId}_${correctOptionId}`);
        const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
        // Layout: iv (12 bytes) + ciphertext + tag (16 bytes); WebCrypto takes ciphertext+tag together.
        const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
        return new TextDecoder().decode(plain);
    } catch {
        return null;
    }
}

/** Grade one answered question offline: right/wrong, the correct option and its explanation. */
export async function reviewAnswer(
    scope: AnswerScope,
    question: { id: number; answer_hash?: string | null; explanation_sealed?: string | null; options: Array<{ id: number }> },
    selectedOptionId: number | null,
): Promise<{ isCorrect: boolean; correctOptionId: number | null; explanation: string | null }> {
    const correctOptionId = await findCorrectOptionId(scope, question.id, question.options.map((o) => o.id), question.answer_hash);
    return {
        isCorrect: correctOptionId !== null && selectedOptionId === correctOptionId,
        correctOptionId,
        explanation: await openExplanation(scope, question.id, correctOptionId, question.explanation_sealed),
    };
}
