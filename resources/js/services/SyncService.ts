import {
    getUnsyncedAttempts,
    markAttemptSynced,
    getUnsyncedProgress,
    markProgressSynced,
    getUnsyncedGamification,
    markGamificationSynced,
} from './OfflineService';
import { db, type SyncQueueItem } from '../db/database';
import { flushFeedbackOutbox } from './FeedbackOutbox';
import { reportServerReachable } from './Connectivity';
import { getAdminAuthHeaders, notifyAdminDataChanged } from './AdminOfflineService';
import {
    belongsTo,
    classifyResponse,
    describeError,
    enqueue,
    getSyncUser,
    isDue,
    markFailed,
    MAX_SERVER_ERROR_ATTEMPTS,
    nextAttemptAt,
    remapTempId,
    setSyncUser,
} from './SyncQueue';

let syncInProgress = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
let authRequired = false;

export const SYNC_COMPLETED_EVENT = 'app:sync-completed';
export const SYNC_AUTH_REQUIRED_EVENT = 'app:sync-auth-required';
export const SYNC_STARTED_EVENT = 'app:sync-started';
const PENDING_LOGOUT_KEY = 'acedrill:pending-logout';

/** Why a sync pass stopped early. Anything but 'done' leaves the remaining work queued. */
type PassResult = 'done' | 'auth' | 'offline' | 'waiting';

function getCsrfToken(): string {
    // Laravel sets XSRF-TOKEN as a cookie (URL-encoded); use that instead of the meta tag
    // (the meta tag is not present in this app's Blade template).
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith('XSRF-TOKEN='));
    return match ? decodeURIComponent(match.split('=')[1]) : '';
}

function jsonHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': getCsrfToken(),
    };
}

// ── Session ──

/**
 * Confirms the server is reachable and the session is valid before anything is sent.
 * The response also refreshes the XSRF cookie and says which account is signed in.
 */
async function checkSession(): Promise<{ status: 'ok'; userId: string } | { status: 'auth' | 'offline' }> {
    const result = await requestSession();
    reportServerReachable(result.status !== 'offline');
    return result;
}

async function requestSession(): Promise<{ status: 'ok'; userId: string } | { status: 'auth' | 'offline' }> {
    try {
        const res = await fetch('/api/v1/sync/session', {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (res.status === 401 || res.status === 419) return { status: 'auth' };
        if (!res.ok) return { status: 'offline' };
        const data = await res.json().catch(() => null);
        return data?.user_id ? { status: 'ok', userId: String(data.user_id) } : { status: 'offline' };
    } catch {
        return { status: 'offline' };
    }
}

function setAuthRequired(value: boolean): void {
    if (authRequired === value) return;
    authRequired = value;
    window.dispatchEvent(new CustomEvent(SYNC_AUTH_REQUIRED_EVENT, { detail: { authRequired: value } }));
}

export function isSyncAuthRequired(): boolean {
    return authRequired;
}

// ── Quiz attempts ──

async function syncQuizAttempts(userId: string): Promise<{ result: PassResult; synced: number }> {
    const attempts = (await getUnsyncedAttempts())
        .filter(a => a.status === 'completed' && a.sync_status !== 'failed' && belongsTo(a.user_id, userId))
        // Oldest first, so streaks are rebuilt in the order the learner actually studied.
        .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));
    let synced = 0;

    for (const attempt of attempts) {
        if (!isDue(attempt.next_sync_at)) return { result: 'waiting', synced };

        let res: Response;
        try {
            res = await fetch(`/api/v1/quizzes/attempts/${attempt.id}/sync`, {
                method: 'POST',
                credentials: 'same-origin',
                headers: jsonHeaders(),
                body: JSON.stringify({
                    quiz_id: attempt.quiz_id,
                    answers: attempt.answers.map(a => ({
                        question_id: a.question_id,
                        selected_option_id: a.selected_option_id,
                    })),
                    duration_seconds: attempt.duration_seconds,
                    started_at: attempt.started_at,
                    completed_at: attempt.completed_at,
                }),
            });
        } catch {
            return { result: 'offline', synced };
        }

        const body = await res.json().catch(() => null);
        const outcome = classifyResponse(res.status, 'POST', body);

        if (outcome === 'ok') {
            await markAttemptSynced(attempt.id);
            await db.quizAttempts.update(attempt.id, { user_id: userId, sync_status: undefined, sync_error: null });
            synced++;
            continue;
        }
        if (outcome === 'auth') return { result: 'auth', synced };

        const attemptsSoFar = (attempt.sync_attempts ?? 0) + 1;
        if (outcome === 'permanent' || attemptsSoFar >= MAX_SERVER_ERROR_ATTEMPTS) {
            await db.quizAttempts.update(attempt.id, {
                sync_status: 'failed',
                sync_error: describeError(res.status, body),
                sync_attempts: attemptsSoFar,
            });
            continue;
        }

        await db.quizAttempts.update(attempt.id, {
            sync_attempts: attemptsSoFar,
            next_sync_at: nextAttemptAt(attemptsSoFar),
        });
        return { result: 'waiting', synced };
    }

    return { result: 'done', synced };
}

// ── Topic progress ──

async function syncProgress(userId: string): Promise<{ result: PassResult; synced: number }> {
    const progressItems = (await getUnsyncedProgress()).filter(p => belongsTo(p.user_id, userId));
    let synced = 0;

    for (const p of progressItems) {
        let res: Response;
        try {
            res = await fetch('/api/v1/progress/sync', {
                method: 'POST',
                credentials: 'same-origin',
                headers: jsonHeaders(),
                body: JSON.stringify({
                    topic_id: p.topic_id,
                    questions_attempted: p.questions_attempted,
                    questions_correct: p.questions_correct,
                    mastery_score: p.mastery_score,
                    ability_score: p.ability_score,
                }),
            });
        } catch {
            return { result: 'offline', synced };
        }

        const outcome = classifyResponse(res.status, 'POST', await res.json().catch(() => null));
        if (outcome === 'auth') return { result: 'auth', synced };
        if (outcome === 'transient') return { result: 'waiting', synced };
        // Progress is derived from graded attempts, so a rejected snapshot is safe to drop.
        if (p.id) await markProgressSynced(p.id);
        if (outcome === 'ok') synced++;
    }

    return { result: 'done', synced };
}

/**
 * XP is only ever awarded by the server for graded work, so local gamification rows are
 * display caches. Older app versions may have left some marked unsynced: settle them.
 */
async function settleLegacyGamification(): Promise<void> {
    const items = await getUnsyncedGamification();
    for (const g of items) {
        if (g.id) await markGamificationSynced(g.id);
    }
}

// ── Admin / teacher change queue ──

function extractSavedRecord(data: any): any {
    return data?.learner || data?.subject || data?.question || data?.class || data?.school
        || data?.admin || data?.teacher || data?.topic || data?.data;
}

async function applyToLocalTable(item: SyncQueueItem, data: any): Promise<void> {
    const tableObj = (db as any)[item.table_name];
    if (!tableObj) return;
    try {
        if (item.action === 'delete') {
            const key = isNaN(Number(item.record_id)) ? item.record_id : Number(item.record_id);
            await tableObj.delete(key);
            return;
        }
        const saved = extractSavedRecord(data);
        if (item.action === 'insert' && item.record_id.startsWith('temp_')) {
            await tableObj.delete(item.record_id);
            if (saved) {
                await tableObj.put({ ...saved, _pendingSync: false });
            } else if (Array.isArray(data?.questions)) {
                await tableObj.bulkPut(data.questions.map((q: any) => ({ ...q, _pendingSync: false })));
            }
        } else if (saved) {
            await tableObj.put({ ...saved, _pendingSync: false });
        }
    } catch (e) {
        console.warn('[SyncService] Local table update error:', e);
    }
}

async function syncAdminQueue(userId: string): Promise<{ result: PassResult; synced: number }> {
    // Strict creation order: an edit never runs before the create it depends on.
    const items = (await db.syncQueue.orderBy('id').toArray())
        .filter(q => !q.synced && q.status !== 'failed' && belongsTo(q.user_id, userId));
    let synced = 0;

    for (const queued of items) {
        // Re-read: an earlier item in this pass may have remapped its temp id.
        const item = queued.id ? await db.syncQueue.get(queued.id) : queued;
        if (!item || item.status === 'failed') continue;
        if (!isDue(item.next_attempt_at)) return { result: 'waiting', synced };

        if (!item.idempotency_key) {
            item.idempotency_key = crypto.randomUUID();
            await db.syncQueue.update(item.id!, { idempotency_key: item.idempotency_key });
        }
        if (!item.sent) await db.syncQueue.update(item.id!, { sent: true });

        let res: Response;
        try {
            res = await fetch(item.endpoint, {
                method: item.method,
                headers: { ...getAdminAuthHeaders(), 'Idempotency-Key': item.idempotency_key },
                credentials: 'include',
                body: item.payload && item.payload !== '{}' ? item.payload : undefined,
            });
        } catch {
            return { result: 'offline', synced };
        }

        const data = await res.json().catch(() => ({}));
        const outcome = classifyResponse(res.status, item.method, data);

        if (outcome === 'ok') {
            await applyToLocalTable(item, data);
            const saved = extractSavedRecord(data);
            if (item.action === 'insert' && saved?.id !== undefined) {
                await remapTempId(item.record_id, saved.id);
            }
            await db.syncQueue.delete(item.id!);
            synced++;
            continue;
        }
        if (outcome === 'auth') return { result: 'auth', synced };
        if (outcome === 'permanent') {
            await markFailed(item, describeError(res.status, data));
            continue;
        }

        const retries = (item.retries ?? 0) + 1;
        if (retries >= MAX_SERVER_ERROR_ATTEMPTS) {
            await markFailed(item, 'The server could not process this change.');
            continue;
        }
        await db.syncQueue.update(item.id!, { retries, next_attempt_at: nextAttemptAt(retries) });
        return { result: 'waiting', synced };
    }

    return { result: 'done', synced };
}

// ── Cross-tab lock ──

const SYNC_LOCK = 'acedrill-sync';
const LEASE_KEY = 'acedrill:sync-lease';
const LEASE_MS = 60_000;
const tabId = Math.random().toString(36).slice(2);

/** Only one tab syncs at a time, so two tabs never send the same queued change together. */
async function withSyncLock<T>(fn: () => Promise<T>): Promise<T | null> {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request(SYNC_LOCK, { ifAvailable: true }, async (lock) => (lock ? fn() : null));
    }

    // Fallback for browsers without the Web Locks API: a short localStorage lease.
    try {
        const lease = JSON.parse(localStorage.getItem(LEASE_KEY) || 'null');
        if (lease && lease.owner !== tabId && lease.until > Date.now()) return null;
        localStorage.setItem(LEASE_KEY, JSON.stringify({ owner: tabId, until: Date.now() + LEASE_MS }));
    } catch {
        // No storage: proceed; the server's idempotency keys still prevent duplicates.
    }
    try {
        return await fn();
    } finally {
        try {
            const lease = JSON.parse(localStorage.getItem(LEASE_KEY) || 'null');
            if (lease?.owner === tabId) localStorage.removeItem(LEASE_KEY);
        } catch {
            // ignore
        }
    }
}

// ── Sign-out made while offline ──

/** Remember a sign-out that could not reach the server, so it completes once back online. */
export function markPendingLogout(userId: string | null): void {
    try {
        localStorage.setItem(PENDING_LOGOUT_KEY, userId ?? '');
    } catch {
        // ignore
    }
}

function getPendingLogout(): string | null {
    try {
        return localStorage.getItem(PENDING_LOGOUT_KEY);
    } catch {
        return null;
    }
}

/**
 * End the server session. Returns false when the server could not be reached.
 * A 419 means only the CSRF token was stale: refresh it and try once more.
 */
export async function postLogout(): Promise<boolean> {
    for (let attempt = 0; attempt < 2; attempt++) {
        let res: Response;
        try {
            res = await fetch('/logout', {
                method: 'POST',
                credentials: 'same-origin',
                headers: jsonHeaders(),
            });
        } catch {
            return false;
        }
        if (res.status === 419 && attempt === 0) {
            await checkSession();
            continue;
        }
        return true;
    }
    return true;
}

async function completePendingLogout(): Promise<void> {
    if (!(await postLogout())) return; // still offline, try again next pass
    try {
        localStorage.removeItem(PENDING_LOGOUT_KEY);
    } catch {
        // ignore
    }
    window.location.href = '/login';
}

// ── Send now, or queue ──

export type SendOrQueueResult<T = any> =
    | { status: 'sent'; data: T }
    | { status: 'queued' }
    | { status: 'rejected'; error: string };

/**
 * For learner actions that should reach the server even if the device is offline:
 * online, send immediately so the screen can show the server's answer; if that fails
 * (offline, server trouble, expired session) queue it with the same idempotency key,
 * so a request that did reach the server can't be applied twice. A rejection the
 * server will always give (validation) is returned instead of queued.
 */
export async function sendOrQueue<T = any>(input: {
    table_name: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    payload: unknown;
}): Promise<SendOrQueueResult<T>> {
    const idempotencyKey = crypto.randomUUID();
    let attempted = false;

    if (navigator.onLine) {
        attempted = true;
        try {
            const res = await fetch(input.endpoint, {
                method: input.method,
                credentials: 'same-origin',
                headers: { ...jsonHeaders(), 'Idempotency-Key': idempotencyKey },
                body: JSON.stringify(input.payload),
            });
            const data = await res.json().catch(() => null);
            const outcome = classifyResponse(res.status, input.method, data);
            if (outcome === 'ok') return { status: 'sent', data };
            if (outcome === 'permanent') return { status: 'rejected', error: describeError(res.status, data) };
        } catch {
            // Network failure: queue below.
        }
    }

    await enqueue({
        table_name: input.table_name,
        action: 'insert',
        record_id: `${input.table_name}_${idempotencyKey}`,
        endpoint: input.endpoint,
        method: input.method,
        payload: input.payload,
        idempotency_key: idempotencyKey,
        sent: attempted,
    });
    if (navigator.onLine) void syncAll();
    return { status: 'queued' };
}

// ── Main sync orchestrator ──

export async function syncAll(): Promise<{ synced: number; errors: number }> {
    if (syncInProgress) return { synced: 0, errors: 0 };
    if (!navigator.onLine) return { synced: 0, errors: 0 };

    syncInProgress = true;
    let totalSynced = 0;
    let totalErrors = 0;

    try {
        await withSyncLock(async () => {
            window.dispatchEvent(new CustomEvent(SYNC_STARTED_EVENT));

            // Feedback can come from guests, so it is sent before (and without) a session check.
            await flushFeedbackOutbox().catch(() => 0);

            const session = await checkSession();
            const pendingLogout = getPendingLogout();

            if (session.status === 'auth') {
                if (pendingLogout !== null) {
                    try { localStorage.removeItem(PENDING_LOGOUT_KEY); } catch { /* ignore */ }
                } else {
                    setAuthRequired(true);
                }
                return;
            }
            if (session.status !== 'ok') return;

            setAuthRequired(false);
            const userId = session.userId;
            let logoutAfterSync = pendingLogout !== null && (pendingLogout === '' || pendingLogout === userId);
            if (pendingLogout !== null && !logoutAfterSync) {
                // Someone else has signed in since, so the old session is already gone.
                try { localStorage.removeItem(PENDING_LOGOUT_KEY); } catch { /* ignore */ }
                logoutAfterSync = false;
            }
            if (!logoutAfterSync && getSyncUser() !== userId) setSyncUser(userId);

            // Each step runs in turn (not in parallel) so XP and progress updates for one
            // learner never race each other on the server.
            const steps = [
                () => syncQuizAttempts(userId),
                () => syncProgress(userId),
                () => syncAdminQueue(userId),
            ];
            for (const step of steps) {
                try {
                    const { result, synced } = await step();
                    totalSynced += synced;
                    if (result === 'auth') {
                        setAuthRequired(true);
                        return;
                    }
                    if (result === 'offline') return;
                } catch (e) {
                    totalErrors++;
                    console.warn('[SyncService] Sync step failed:', e);
                }
            }
            await settleLegacyGamification();

            // The user signed out while offline: their work is synced, now end the session.
            if (logoutAfterSync) {
                await completePendingLogout();
            }
        });
    } finally {
        syncInProgress = false;
        // Only when something changed: pages refetch their lists on this event.
        if (totalSynced > 0) notifyAdminDataChanged();
        window.dispatchEvent(new CustomEvent(SYNC_COMPLETED_EVENT, {
            detail: { synced: totalSynced, errors: totalErrors, authRequired },
        }));
    }

    return { synced: totalSynced, errors: totalErrors };
}

// ── Auto-sync on reconnect ──

export function startAutoSync(intervalMs: number = 30000): void {
    if (syncInterval) clearInterval(syncInterval);

    window.addEventListener('online', handleOnlineSync);
    document.addEventListener('visibilitychange', handleVisibleSync);

    // Also try syncing periodically when online
    syncInterval = setInterval(() => {
        if (navigator.onLine) {
            syncAll();
        }
    }, intervalMs);

    // Pick up anything left from a previous session straight away.
    if (navigator.onLine) syncAll();
}

export function stopAutoSync(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    window.removeEventListener('online', handleOnlineSync);
    document.removeEventListener('visibilitychange', handleVisibleSync);
}

function handleOnlineSync(): void {
    syncAll();
}

function handleVisibleSync(): void {
    if (document.visibilityState === 'visible' && navigator.onLine) syncAll();
}

// ── Sync status type ──

export interface SyncStatus {
    isOnline: boolean;
    pendingSync: number;
    isSyncing: boolean;
    lastSyncTime: string | null;
}
