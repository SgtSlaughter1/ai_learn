import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Minimal browser globals for SyncService (the test runner is plain Node).
const store = new Map<string, string>();
vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { href: 'http://localhost/', origin: 'http://localhost', protocol: 'http:', host: 'localhost' } }));
vi.mock('@inertiajs/react', () => ({ router: { on: vi.fn(), visit: vi.fn(), push: vi.fn(), replace: vi.fn() } }));
vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
});
vi.stubGlobal('navigator', { onLine: true });
vi.stubGlobal('document', { cookie: '', addEventListener: () => {}, visibilityState: 'visible' });

let signedInAs: string | null = null;
vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/api/v1/sync/session')) {
        return new Response(JSON.stringify({ user_id: signedInAs }), { status: 200 });
    }
    return new Response(JSON.stringify({ results: [] }), { status: 200 });
}));

let sync: typeof import('../SyncService');
let db: typeof import('../../db/database')['db'];

beforeAll(async () => {
    sync = await import('../SyncService');
    db = (await import('../../db/database')).db;
});

beforeEach(async () => {
    await db.quizAttempts.clear();
    // Work left on the device, waiting for its owner to sign in again.
    await db.quizAttempts.put({
        id: 'attempt-1', user_id: 'user-a', quiz_id: 1, status: 'completed', score: 1, total_marks: 2,
        started_at: '2026-10-19T10:00:00Z', completed_at: '2026-10-19T10:01:00Z', duration_seconds: 60,
        answers: [], synced: false,
    });
});

describe('session-ended warning', () => {
    it('is raised when a sync finds nobody signed in, and cleared as soon as a signed-in page loads', async () => {
        signedInAs = null; // e.g. the sync that runs on the login page
        await sync.syncAll();
        expect(sync.isSyncAuthRequired()).toBe(true);

        const cleared = vi.fn();
        window.addEventListener(sync.SYNC_AUTH_REQUIRED_EVENT, cleared);
        signedInAs = 'user-a';
        sync.confirmSignedIn(); // the dashboard after signing in

        expect(sync.isSyncAuthRequired()).toBe(false);
        expect(cleared).toHaveBeenCalledOnce();
    });

    it('does nothing when no warning is showing', () => {
        const spy = vi.fn();
        window.addEventListener(sync.SYNC_AUTH_REQUIRED_EVENT, spy);
        sync.confirmSignedIn();
        expect(spy).not.toHaveBeenCalled();
    });
});
