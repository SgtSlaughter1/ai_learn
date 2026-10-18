import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/database';
import {
    classifyResponse,
    enqueue,
    getFailedQueueItems,
    markFailed,
    remapTempId,
    setSyncUser,
} from '../SyncQueue';

const pending = () => db.syncQueue.orderBy('id').toArray();

beforeEach(async () => {
    await db.syncQueue.clear();
    setSyncUser('user-a');
});

describe('classifyResponse', () => {
    it('pauses on expired sessions instead of dropping work', () => {
        expect(classifyResponse(401, 'POST', {})).toBe('auth');
        expect(classifyResponse(419, 'POST', {})).toBe('auth');
    });

    it('retries server trouble and in-flight duplicates', () => {
        expect(classifyResponse(500, 'POST', {})).toBe('transient');
        expect(classifyResponse(503, 'PUT', {})).toBe('transient');
        expect(classifyResponse(429, 'POST', {})).toBe('transient');
        expect(classifyResponse(409, 'POST', { code: 'request_in_progress' })).toBe('transient');
    });

    it('sets aside changes the server will never accept', () => {
        expect(classifyResponse(422, 'POST', {})).toBe('permanent');
        expect(classifyResponse(403, 'PUT', {})).toBe('permanent');
        expect(classifyResponse(409, 'POST', { code: 'attempt_owner_mismatch' })).toBe('permanent');
    });

    it('treats deleting something already gone as done', () => {
        expect(classifyResponse(404, 'DELETE', {})).toBe('ok');
        expect(classifyResponse(404, 'PUT', {})).toBe('permanent');
    });
});

describe('enqueue', () => {
    it('tags changes with their owner and an idempotency key', async () => {
        await enqueue({ table_name: 'adminLearners', action: 'update', record_id: 'u1', endpoint: '/api/v1/admin/learners/u1', method: 'PUT', payload: { name: 'Ada' } });
        const [item] = await pending();
        expect(item.user_id).toBe('user-a');
        expect(item.idempotency_key).toMatch(/[0-9a-f-]{36}/);
        expect(item.status).toBe('pending');
    });

    it('folds an edit of an offline-created record into the create', async () => {
        await enqueue({ table_name: 'subjects', action: 'insert', record_id: 'temp_1', endpoint: '/api/v1/admin/subjects', method: 'POST', payload: { name: 'Maths', description: 'old' } });
        await enqueue({ table_name: 'subjects', action: 'update', record_id: 'temp_1', endpoint: '/api/v1/admin/subjects/temp_1', method: 'PUT', payload: { description: 'new' } });

        const items = await pending();
        expect(items).toHaveLength(1);
        expect(items[0].action).toBe('insert');
        expect(JSON.parse(items[0].payload)).toEqual({ name: 'Maths', description: 'new' });
    });

    it('does not merge into a create that may already have reached the server', async () => {
        await enqueue({ table_name: 'subjects', action: 'insert', record_id: 'temp_2', endpoint: '/api/v1/admin/subjects', method: 'POST', payload: { name: 'Maths' }, sent: true });
        await enqueue({ table_name: 'subjects', action: 'update', record_id: 'temp_2', endpoint: '/api/v1/admin/subjects/temp_2', method: 'PUT', payload: { name: 'Further Maths' } });

        expect(await pending()).toHaveLength(2);
    });

    it('keeps the password of a pending create when an edit leaves it blank', async () => {
        await enqueue({ table_name: 'adminLearners', action: 'insert', record_id: 'temp_lrn_1', endpoint: '/api/v1/admin/learners', method: 'POST', payload: { name: 'Ada', password: 'secret-1' } });
        await enqueue({ table_name: 'adminLearners', action: 'update', record_id: 'temp_lrn_1', endpoint: '/api/v1/admin/learners/temp_lrn_1', method: 'PUT', payload: { name: 'Ada L.', password: '' } });

        expect(JSON.parse((await pending())[0].payload)).toEqual({ name: 'Ada L.', password: 'secret-1' });
    });

    it('collapses repeated edits of the same record', async () => {
        await enqueue({ table_name: 'adminLearners', action: 'update', record_id: 'u1', endpoint: '/x/u1', method: 'PUT', payload: { name: 'A', email: 'a@x.ng' } });
        await enqueue({ table_name: 'adminLearners', action: 'update', record_id: 'u1', endpoint: '/x/u1', method: 'PUT', payload: { name: 'B' } });

        const items = await pending();
        expect(items).toHaveLength(1);
        expect(JSON.parse(items[0].payload)).toEqual({ name: 'B', email: 'a@x.ng' });
    });

    it('cancels everything when an offline-created record is deleted before syncing', async () => {
        await enqueue({ table_name: 'topics', action: 'insert', record_id: 'temp_3', endpoint: '/t', method: 'POST', payload: { name: 'Algebra' } });
        await enqueue({ table_name: 'topics', action: 'update', record_id: 'temp_3', endpoint: '/t/temp_3', method: 'PUT', payload: { name: 'Algebra II' } });
        const id = await enqueue({ table_name: 'topics', action: 'delete', record_id: 'temp_3', endpoint: '/t/temp_3', method: 'DELETE' });

        expect(id).toBeNull();
        expect(await pending()).toHaveLength(0);
    });

    it('drops pending edits of a server record that is then deleted', async () => {
        await enqueue({ table_name: 'topics', action: 'update', record_id: '42', endpoint: '/t/42', method: 'PUT', payload: { name: 'X' } });
        await enqueue({ table_name: 'topics', action: 'delete', record_id: '42', endpoint: '/t/42', method: 'DELETE' });

        const items = await pending();
        expect(items).toHaveLength(1);
        expect(items[0].action).toBe('delete');
    });
});

describe('remapTempId', () => {
    it('points later changes at the real id once the create has synced', async () => {
        await enqueue({ table_name: 'topics', action: 'insert', record_id: 'temp_9', endpoint: '/t', method: 'POST', payload: { name: 'A' }, sent: true });
        await enqueue({ table_name: 'topics', action: 'update', record_id: 'temp_9', endpoint: '/api/v1/admin/topics/temp_9', method: 'PUT', payload: { name: 'B' } });
        await enqueue({ table_name: 'adminQuestions', action: 'insert', record_id: 'temp_q', endpoint: '/q', method: 'POST', payload: { topic_id: 'temp_9' } });

        await remapTempId('temp_9', 77);

        const items = await pending();
        const update = items.find((q) => q.action === 'update')!;
        expect(update.record_id).toBe('77');
        expect(update.endpoint).toBe('/api/v1/admin/topics/77');
        expect(JSON.parse(items.find((q) => q.table_name === 'adminQuestions')!.payload)).toEqual({ topic_id: 77 });
    });
});

describe('markFailed', () => {
    it('sets aside a rejected create together with the changes that depend on it', async () => {
        await enqueue({ table_name: 'adminClasses', action: 'insert', record_id: 'temp_c', endpoint: '/c', method: 'POST', payload: { name: 'SS1 Gold' }, sent: true });
        await enqueue({ table_name: 'adminClasses', action: 'update', record_id: 'temp_c', endpoint: '/c/temp_c', method: 'PUT', payload: { name: 'SS1 Blue' } });
        await enqueue({ table_name: 'adminLearners', action: 'update', record_id: 'u5', endpoint: '/l/u5', method: 'PUT', payload: { name: 'Unrelated' } });

        const [insert] = await pending();
        await markFailed(insert, 'The name has already been taken.');

        const failed = await getFailedQueueItems();
        expect(failed.map((q) => q.record_id).sort()).toEqual(['temp_c', 'temp_c']);
        expect(failed.find((q) => q.action === 'insert')!.error).toBe('The name has already been taken.');

        const stillPending = (await pending()).filter((q) => q.status === 'pending');
        expect(stillPending.map((q) => q.record_id)).toEqual(['u5']);
    });

    it("only shows the signed-in user's set-aside changes", async () => {
        await enqueue({ table_name: 'topics', action: 'update', record_id: '1', endpoint: '/t/1', method: 'PUT', payload: {} });
        setSyncUser('user-b');
        await enqueue({ table_name: 'topics', action: 'update', record_id: '2', endpoint: '/t/2', method: 'PUT', payload: {} });

        for (const item of await pending()) await markFailed(item, 'nope');

        expect((await getFailedQueueItems('user-a')).map((q) => q.record_id)).toEqual(['1']);
        expect((await getFailedQueueItems('user-b')).map((q) => q.record_id)).toEqual(['2']);
    });
});
