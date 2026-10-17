import { db, type SyncQueueItem } from '../db/database';

// ── Who owns offline work on this device ──
//
// Every queued change and offline quiz attempt is tagged with the account that made it,
// and only ever synced under that account. The id is kept in localStorage so it is
// known at startup even when the app boots offline.

const SYNC_USER_KEY = 'acedrill:sync-user';
let syncUserId: string | null = null;

export function setSyncUser(userId: string | null): void {
    syncUserId = userId;
    try {
        if (userId) localStorage.setItem(SYNC_USER_KEY, userId);
        else localStorage.removeItem(SYNC_USER_KEY);
    } catch {
        // Storage unavailable (private mode): the in-memory value still applies.
    }
}

export function getSyncUser(): string | null {
    if (syncUserId) return syncUserId;
    try {
        syncUserId = localStorage.getItem(SYNC_USER_KEY);
    } catch {
        syncUserId = null;
    }
    return syncUserId;
}

/** Legacy rows were saved before ownership was recorded; they sync under whoever signs in. */
export function belongsTo(ownerId: string | null | undefined, userId: string): boolean {
    return !ownerId || ownerId === 'current' || ownerId === userId;
}

/** Lets status indicators refresh their counts as soon as the queue changes. */
export const SYNC_QUEUE_CHANGED_EVENT = 'app:sync-queue-changed';

export function notifyQueueChanged(): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_QUEUE_CHANGED_EVENT));
}

// ── Response classification ──

export type SyncOutcome = 'ok' | 'auth' | 'transient' | 'permanent';

/**
 * ok        – applied (or already applied)
 * auth      – session expired: pause syncing until the user signs in, keep everything
 * transient – network/server trouble: retry later with backoff, keep order
 * permanent – the server will never accept this as-is: set aside for the user
 */
export function classifyResponse(status: number, method: string, body: any): SyncOutcome {
    if (status >= 200 && status < 300) return 'ok';
    if (status === 401 || status === 419) return 'auth';
    if (status === 409 && body?.code === 'request_in_progress') return 'transient';
    if (status === 404 && method === 'DELETE') return 'ok'; // already gone
    if (status === 408 || status === 425 || status === 429 || status >= 500) return 'transient';
    return 'permanent';
}

export function describeError(status: number, body: any): string {
    if (body?.errors && typeof body.errors === 'object') {
        const first = Object.values(body.errors).flat()[0];
        if (typeof first === 'string') return first;
    }
    return body?.message || body?.error || `Server responded with status ${status}`;
}

// ── Backoff ──

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 15 * 60_000;
/** Server errors (not network drops) after which an item is set aside so it stops blocking the queue. */
export const MAX_SERVER_ERROR_ATTEMPTS = 8;

/** Exponential backoff with jitter; never sooner than the server's Retry-After, when it sent one. */
export function nextAttemptAt(attempts: number, retryAfterSeconds: number | null = null): string {
    const backoff = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1));
    const delay = Math.max(backoff, (retryAfterSeconds ?? 0) * 1000);
    const jitter = Math.random() * delay * 0.2;
    return new Date(Date.now() + delay + jitter).toISOString();
}

export function isDue(nextAt: string | null | undefined): boolean {
    return !nextAt || new Date(nextAt).getTime() <= Date.now();
}

// ── Queue writes ──

export interface EnqueueInput {
    table_name: string;
    action: 'insert' | 'update' | 'delete';
    record_id: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'DELETE';
    payload?: unknown;
    /** Reuse the key of a request that was already sent, so a replay cannot apply twice. */
    idempotency_key?: string;
    /** True when a request with this key may already have reached the server. */
    sent?: boolean;
}

function parsePayload(payload: string): Record<string, unknown> {
    try {
        const parsed = JSON.parse(payload || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * Add a change to the queue, merging it with earlier changes to the same record that
 * have not been sent yet:
 *  - an edit of a record created offline is folded into the create;
 *  - repeated edits of one record collapse into one;
 *  - deleting a record created offline cancels the create and its edits entirely.
 * Returns the queue item id, or null when the change cancelled out.
 */
export async function enqueue(input: EnqueueInput): Promise<number | null> {
    const id = await enqueueItem(input);
    notifyQueueChanged();
    return id;
}

async function enqueueItem(input: EnqueueInput): Promise<number | null> {
    const userId = getSyncUser();
    const payload = input.payload === undefined ? {} : input.payload;

    return db.transaction('rw', db.syncQueue, async () => {
        const related = await db.syncQueue
            .where('record_id')
            .equals(String(input.record_id))
            .filter((q) => q.table_name === input.table_name && q.status !== 'failed' && !q.synced)
            .sortBy('id');

        const unsent = related.filter((q) => !q.sent);
        const unsentInsert = unsent.find((q) => q.action === 'insert');

        if (input.action === 'update' && !input.sent) {
            const target = unsentInsert ?? unsent.filter((q) => q.action === 'update').pop();
            if (target?.id) {
                const merged = { ...parsePayload(target.payload), ...(payload as object) };
                await db.syncQueue.update(target.id, { payload: JSON.stringify(merged) });
                return target.id;
            }
        }

        if (input.action === 'delete' && !input.sent) {
            const unsentIds = unsent.map((q) => q.id!).filter(Boolean);
            if (unsentIds.length) await db.syncQueue.bulkDelete(unsentIds);
            // Created and deleted before the server ever saw it: nothing to send.
            if (unsentInsert) {
                return null;
            }
        }

        return db.syncQueue.add({
            table_name: input.table_name,
            action: input.action,
            record_id: String(input.record_id),
            endpoint: input.endpoint,
            method: input.method,
            payload: JSON.stringify(payload),
            created_at: new Date().toISOString(),
            synced: false,
            retries: 0,
            idempotency_key: input.idempotency_key ?? crypto.randomUUID(),
            user_id: userId,
            status: 'pending',
            sent: Boolean(input.sent),
            next_attempt_at: null,
        });
    });
}

/**
 * After an offline-created record reaches the server, point every later queued change
 * at its real id (URL, record id and any payload field that referenced the temp id).
 */
export async function remapTempId(tempId: string, serverId: string | number): Promise<void> {
    if (!tempId.startsWith('temp_')) return;
    const quotedTemp = JSON.stringify(tempId);
    const replacement = typeof serverId === 'number' ? String(serverId) : JSON.stringify(serverId);

    await db.syncQueue
        .filter((q) => !q.synced && q.status !== 'failed')
        .modify((q) => {
            if (q.record_id === tempId) q.record_id = String(serverId);
            if (q.endpoint.includes(tempId)) q.endpoint = q.endpoint.split(tempId).join(String(serverId));
            if (q.payload.includes(quotedTemp)) q.payload = q.payload.split(quotedTemp).join(replacement);
        });
}

/** Set aside an item the server rejected, plus every later change that depends on it. */
export async function markFailed(item: SyncQueueItem, error: string): Promise<void> {
    if (!item.id) return;
    await db.syncQueue.update(item.id, { status: 'failed', error });

    const dependsOnRecord = item.record_id.startsWith('temp_') ? item.record_id : null;
    if (item.action === 'insert' && dependsOnRecord) {
        await db.syncQueue
            .filter((q) => q.id !== item.id && q.status !== 'failed' && !q.synced
                && (q.record_id === dependsOnRecord || q.endpoint.includes(dependsOnRecord) || q.payload.includes(dependsOnRecord)))
            .modify({ status: 'failed', error: 'Depends on a change that could not be saved.' });
    }
}

// ── "Needs attention" helpers ──

export async function getFailedQueueItems(userId: string | null = getSyncUser()): Promise<SyncQueueItem[]> {
    const failed = await db.syncQueue.where('status').equals('failed').toArray();
    return userId ? failed.filter((q) => belongsTo(q.user_id, userId)) : failed;
}

/** Put a set-aside item back in the queue (e.g. after fixing the data it conflicted with). */
export async function retryFailedQueueItem(id: number): Promise<void> {
    await db.syncQueue.update(id, { status: 'pending', error: undefined, retries: 0, next_attempt_at: null });
    notifyQueueChanged();
}

export async function discardFailedQueueItem(id: number): Promise<void> {
    await db.syncQueue.delete(id);
    notifyQueueChanged();
}

export async function hasPendingQueueItems(userId: string | null = getSyncUser()): Promise<boolean> {
    const pending = await db.syncQueue.filter((q) => !q.synced && q.status !== 'failed').toArray();
    return userId ? pending.some((q) => belongsTo(q.user_id, userId)) : pending.length > 0;
}
