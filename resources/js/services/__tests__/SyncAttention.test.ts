import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../SyncService', () => ({ syncAll: vi.fn() }));
vi.mock('../AdminOfflineService', () => ({ notifyAdminDataChanged: vi.fn() }));

import { db } from '../../db/database';
import { enqueue, markFailed, setSyncUser } from '../SyncQueue';
import { discardAttentionItem, getAttentionItems, retryAttentionItem } from '../SyncAttention';

beforeEach(async () => {
    await Promise.all([db.syncQueue.clear(), db.quizAttempts.clear(), db.adminLearners.clear()]);
    setSyncUser('user-a');
});

async function failedLearnerInsert() {
    await db.adminLearners.put({ id: 'temp_lrn_1', name: 'Ada Obi', email: 'ada@school.ng', _pendingSync: true } as any);
    await enqueue({
        table_name: 'adminLearners', action: 'insert', record_id: 'temp_lrn_1',
        endpoint: '/api/v1/admin/learners', method: 'POST', payload: { name: 'Ada Obi', email: 'ada@school.ng' },
    });
    const [item] = await db.syncQueue.toArray();
    await markFailed(item, 'The email has already been taken.');
}

describe('SyncAttention', () => {
    it('describes rejected changes in plain language', async () => {
        await failedLearnerInsert();
        await db.quizAttempts.put({
            id: 'att-1', user_id: 'user-a', quiz_id: 3, quiz_title: 'Algebra Quiz', status: 'completed', score: 5, total_marks: 10,
            started_at: '2026-10-15T10:00:00Z', completed_at: '2026-10-15T10:05:00Z', duration_seconds: 300, answers: [],
            synced: false, sync_status: 'failed', sync_error: 'The questions in this attempt are no longer part of the quiz.',
        });

        const items = await getAttentionItems();
        expect(items.map((i) => [i.title, i.detail, i.error])).toEqual([
            ['Quiz attempt', 'Algebra Quiz', 'The questions in this attempt are no longer part of the quiz.'],
            ['New learner', 'Ada Obi', 'The email has already been taken.'],
        ]);
    });

    it('retry puts the change back in the queue', async () => {
        await failedLearnerInsert();
        const [item] = await getAttentionItems();
        await retryAttentionItem(item);

        const [queued] = await db.syncQueue.toArray();
        expect(queued.status).toBe('pending');
        expect(await getAttentionItems()).toHaveLength(0);
    });

    it('discard removes the change and its placeholder record', async () => {
        await failedLearnerInsert();
        const [item] = await getAttentionItems();
        await discardAttentionItem(item);

        expect(await db.syncQueue.count()).toBe(0);
        expect(await db.adminLearners.get('temp_lrn_1')).toBeUndefined();
    });
});
