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
import { notifyAdminDataChanged } from './AdminOfflineService';
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
        if (!data || !('user_id' in data)) return { status: 'offline' };
        // Reachable, but nobody is signed in on this browser.
        return data.user_id ? { status: 'ok', userId: String(data.user_id) } : { status: 'auth' };
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

// ── Batches ──

/** Changes per batch request (the server accepts up to 25). */
const BATCH_SIZE = 25;

interface BatchItem {
    key: string;
    method: 'POST' | 'PUT' | 'DELETE';
    path: string;
    body: unknown;
}

interface BatchResult {
    key: string;
    status: number | null;
    body: any;
    skipped?: boolean;
    /** 'time_budget': the server ran out of time for this request; send it again right away. */
    reason?: 'halted' | 'time_budget';
}

type BatchResponse =
    | { ok: true; results: BatchResult[] }
    | { ok: false; result: 'offline' | 'auth' | 'transient'; retryAfter: number | null };

function retryAfterSeconds(res: Response): number | null {
    const value = Number(res.headers.get('Retry-After'));
    return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Send up to BATCH_SIZE queued changes in one request. The server applies them in order,
 * each through its own endpoint, and stops at the first one that must be retried.
 */
async function sendBatch(items: BatchItem[]): Promise<BatchResponse> {
    let res: Response;
    try {
        res = await fetch('/api/v1/sync/batch', {
            method: 'POST',
            credentials: 'same-origin',
            headers: jsonHeaders(),
            body: JSON.stringify({ items }),
        });
    } catch {
        return { ok: false, result: 'offline', retryAfter: null };
    }
    if (res.status === 401 || res.status === 419) return { ok: false, result: 'auth', retryAfter: null };
    if (!res.ok) return { ok: false, result: 'transient', retryAfter: retryAfterSeconds(res) };

    const data = await res.json().catch(() => null);
    return Array.isArray(data?.results)
        ? { ok: true, results: data.results }
        : { ok: false, result: 'transient', retryAfter: null };
}

function parseBody(payload: string): unknown {
    if (!payload || payload === '{}') return null;
    try {
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

// ── Quiz attempts ──

async function syncQuizAttempts(userId: string): Promise<{ result: PassResult; synced: number }> {
    let synced = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const due = (await getUnsyncedAttempts())
            .filter(a => a.status === 'completed' && a.sync_status !== 'failed' && belongsTo(a.user_id, userId))
            // Oldest first, so streaks are rebuilt in the order the learner actually studied.
            .sort((a, b) => (a.completed_at ?? '').localeCompare(b.completed_at ?? ''));
        if (due.length === 0) return { result: 'done', synced };

        const chunk = [];
        for (const attempt of due) {
            if (chunk.length >= BATCH_SIZE || !isDue(attempt.next_sync_at)) break; // keep study order
            chunk.push(attempt);
        }
        if (chunk.length === 0) return { result: 'waiting', synced };

        const response = await sendBatch(chunk.map((attempt) => ({
            key: `attempt-${attempt.id}`,
            method: 'POST',
            path: `/api/v1/quizzes/attempts/${attempt.id}/sync`,
            body: {
                quiz_id: attempt.quiz_id,
                answers: attempt.answers.map(a => ({ question_id: a.question_id, selected_option_id: a.selected_option_id })),
                duration_seconds: attempt.duration_seconds,
                started_at: attempt.started_at,
                completed_at: attempt.completed_at,
            },
        })));

        if (!response.ok) {
            if (response.result === 'transient') {
                const tries = (chunk[0].sync_attempts ?? 0) + 1;
                await db.quizAttempts.update(chunk[0].id, { sync_attempts: tries, next_sync_at: nextAttemptAt(tries, response.retryAfter) });
                return { result: 'waiting', synced };
            }
            return { result: response.result, synced };
        }
        if (response.results.length === 0) return { result: 'waiting', synced };

        for (const [index, result] of response.results.entries()) {
            const attempt = chunk[index];
            if (result.skipped || result.status === null) {
                if (result.reason === 'time_budget') break; // next round sends it straight away
                return { result: 'waiting', synced };
            }

            const outcome = classifyResponse(result.status, 'POST', result.body);
            if (outcome === 'ok') {
                await markAttemptSynced(attempt.id);
                await db.quizAttempts.update(attempt.id, { user_id: userId, sync_status: undefined, sync_error: null });
                synced++;
                continue;
            }
            if (outcome === 'auth') return { result: 'auth', synced };

            const tries = (attempt.sync_attempts ?? 0) + 1;
            if (outcome === 'permanent' || tries >= MAX_SERVER_ERROR_ATTEMPTS) {
                await db.quizAttempts.update(attempt.id, {
                    sync_status: 'failed',
                    sync_error: describeError(result.status, result.body),
                    sync_attempts: tries,
                });
                continue;
            }
            await db.quizAttempts.update(attempt.id, { sync_attempts: tries, next_sync_at: nextAttemptAt(tries) });
            return { result: 'waiting', synced };
        }
    }
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

/**
 * The next run of queued changes that can travel together: in order, due, and not
 * referring to a record created earlier in the same batch (its real id is only known
 * once that create has landed).
 */
function nextAdminBatch(items: SyncQueueItem[]): SyncQueueItem[] {
    const batch: SyncQueueItem[] = [];
    const tempIdsInBatch: string[] = [];

    for (const item of items) {
        if (batch.length >= BATCH_SIZE || !isDue(item.next_attempt_at)) break;
        const refersToBatchedCreate = tempIdsInBatch.some(
            (id) => item.record_id === id || item.endpoint.includes(id) || item.payload.includes(id)
        );
        if (refersToBatchedCreate) break;

        batch.push(item);
        if (item.action === 'insert' && item.record_id.startsWith('temp_')) tempIdsInBatch.push(item.record_id);
    }
    return batch;
}

async function syncAdminQueue(userId: string): Promise<{ result: PassResult; synced: number }> {
    let synced = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        // Strict creation order: an edit never runs before the create it depends on.
        // Re-read each round: a create in the previous round may have remapped temp ids.
        const pending = (await db.syncQueue.orderBy('id').toArray())
            .filter(q => !q.synced && q.status !== 'failed' && belongsTo(q.user_id, userId));
        if (pending.length === 0) return { result: 'done', synced };

        const batch = nextAdminBatch(pending);
        if (batch.length === 0) return { result: 'waiting', synced };

        for (const item of batch) {
            if (!item.idempotency_key) item.idempotency_key = crypto.randomUUID();
            await db.syncQueue.update(item.id!, { idempotency_key: item.idempotency_key, sent: true });
        }

        const response = await sendBatch(batch.map((item) => ({
            key: item.idempotency_key!,
            method: item.method,
            path: item.endpoint,
            body: parseBody(item.payload),
        })));

        if (!response.ok) {
            if (response.result === 'transient') {
                const retries = (batch[0].retries ?? 0) + 1;
                await db.syncQueue.update(batch[0].id!, { retries, next_attempt_at: nextAttemptAt(retries, response.retryAfter) });
                return { result: 'waiting', synced };
            }
            return { result: response.result, synced };
        }

        if (response.results.length === 0) return { result: 'waiting', synced };

        for (const [index, result] of response.results.entries()) {
            const item = batch[index];
            if (result.skipped || result.status === null) {
                if (result.reason === 'time_budget') break; // next round sends it straight away
                return { result: 'waiting', synced };
            }

            const outcome = classifyResponse(result.status, item.method, result.body);
            if (outcome === 'ok') {
                await applyToLocalTable(item, result.body ?? {});
                const saved = extractSavedRecord(result.body);
                if (item.action === 'insert' && saved?.id !== undefined) {
                    await remapTempId(item.record_id, saved.id);
                }
                await db.syncQueue.delete(item.id!);
                synced++;
                continue;
            }
            if (outcome === 'auth') return { result: 'auth', synced };
            if (outcome === 'permanent') {
                await markFailed(item, describeError(result.status, result.body));
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
    }
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

/**
 * Whether there's anything to sync under a signed-in session: someone is signed in on
 * this browser, a sign-out is still to be completed, or unsynced work is stored here.
 * Guests browsing public pages have none of these, so no session check is made for them.
 */
async function hasSessionWork(): Promise<boolean> {
    if (getSyncUser() !== null || getPendingLogout() !== null) return true;
    const [queued, attempts] = await Promise.all([
        db.syncQueue.filter(q => !q.synced && q.status !== 'failed').count(),
        db.quizAttempts.filter(a => !a.synced && a.sync_status !== 'failed').count(),
    ]);
    return queued + attempts > 0;
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
            if (!(await hasSessionWork())) return;

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

    // Pick up anything left from a previous session soon after the app opens (a little
    // spread too, for when a whole class opens the app at once).
    if (navigator.onLine) setTimeout(() => void syncAll(), Math.random() * 3_000);
}

export function stopAutoSync(): void {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
    window.removeEventListener('online', handleOnlineSync);
    document.removeEventListener('visibilitychange', handleVisibleSync);
}

/**
 * When a school's Wi-Fi comes back, every device sees "online" at the same moment.
 * Spread their first sync over a short random window so the server isn't hit by the
 * whole classroom in the same second.
 */
const RECONNECT_SPREAD_MS = 20_000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function handleOnlineSync(): void {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void syncAll();
    }, Math.random() * RECONNECT_SPREAD_MS);
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
