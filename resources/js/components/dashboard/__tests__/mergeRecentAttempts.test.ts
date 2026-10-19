import { describe, expect, it } from 'vitest';
import { mergeRecentAttempts, DashboardAttempt } from '../RecentAttemptsList';

const local = (id: string, overrides: Partial<Parameters<typeof mergeRecentAttempts>[0][number]> = {}) => ({
    id,
    quiz_id: 1,
    quiz_title: 'Algebra Quiz',
    status: 'completed',
    score: 4,
    total_marks: 10,
    completed_at: '2026-10-19T10:00:00Z',
    synced: false,
    ...overrides,
});

const server = (id: string, completed_at = '2026-10-19T09:00:00Z'): DashboardAttempt => ({
    id,
    quiz_title: 'Algebra Quiz',
    status: 'completed',
    score: 6,
    total_marks: 10,
    completed_at,
});

describe('mergeRecentAttempts', () => {
    it('shows an attempt once even when it is on the device and on the server', () => {
        const merged = mergeRecentAttempts([local('a')], [server('a'), server('a')], () => undefined);

        expect(merged).toHaveLength(1);
        expect(merged[0].score).toBe(6); // the server's verified score wins
        expect(merged[0].status).toBe('completed');
    });

    it('keeps different attempts of the same quiz apart', () => {
        const merged = mergeRecentAttempts([local('a')], [server('b')], () => undefined);

        expect(merged.map((a) => a.id)).toEqual(['a', 'b']);
    });

    it('marks attempts the server has not verified yet as provisional', () => {
        const [attempt] = mergeRecentAttempts([local('a')], [], () => undefined);

        expect(attempt.status).toBe('provisional');
    });

    it('shows verified device attempts as completed', () => {
        const [attempt] = mergeRecentAttempts([local('a', { synced: true, verified: true, score: 6 })], [], () => undefined);

        expect(attempt.status).toBe('completed');
        expect(attempt.score).toBe(6);
    });

    it('lists the newest first and keeps the limit', () => {
        const merged = mergeRecentAttempts(
            [local('new', { completed_at: '2026-10-19T12:00:00Z' })],
            ['1', '2', '3', '4', '5'].map((id, i) => server(id, `2026-10-18T0${i}:00:00Z`)),
            () => undefined,
        );

        expect(merged).toHaveLength(5);
        expect(merged[0].id).toBe('new');
    });

    it('ignores attempts that were never finished', () => {
        expect(mergeRecentAttempts([local('a', { status: 'started' })], [], () => undefined)).toEqual([]);
    });
});
