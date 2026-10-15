import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { expect, it } from 'vitest';

it('upgrades an existing v4 database without losing queued changes', async () => {
    // A device still on the previous app version, with work waiting to sync.
    const legacy = new Dexie('AceDrillDatabase');
    legacy.version(4).stores({ syncQueue: '++id, table_name, action, synced, created_at' });
    await legacy.table('syncQueue').bulkAdd([
        { table_name: 'subjects', action: 'insert', record_id: 'temp_1', endpoint: '/s', method: 'POST', payload: '{}', created_at: '2026-10-01', synced: false, retries: 0 },
        { table_name: 'topics', action: 'update', record_id: '5', endpoint: '/t/5', method: 'PUT', payload: '{}', created_at: '2026-10-02', synced: false, retries: 2 },
    ]);
    legacy.close();

    const { db } = await import('../database');
    const items = await db.syncQueue.orderBy('id').toArray();

    expect(items).toHaveLength(2);
    expect(items.every((q) => q.status === 'pending' && q.idempotency_key && q.user_id === null)).toBe(true);
    expect(items.map((q) => q.sent)).toEqual([false, true]); // already retried => never merged into
});
