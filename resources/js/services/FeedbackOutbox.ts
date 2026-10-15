/**
 * Feedback can be sent by guests as well as signed-in users, so it can't use the
 * account-bound sync queue. Feedback that can't be sent is kept in localStorage (the
 * same key earlier versions used, so their stranded items are sent too) and resent on
 * every sync pass. Each item carries a client_id; the server stores one copy per id.
 */

const OUTBOX_KEY = 'offline_feedbacks';

export interface FeedbackPayload {
    name?: string;
    email?: string;
    role?: string;
    category?: string;
    rating?: number;
    subject?: string;
    message: string;
    meta?: Record<string, unknown>;
}

type OutboxItem = FeedbackPayload & { client_id?: string; queued_at?: string };

export type FeedbackResult =
    | { status: 'sent'; message?: string }
    | { status: 'queued' }
    | { status: 'rejected'; error: string };

function readOutbox(): OutboxItem[] {
    try {
        const items = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
        return Array.isArray(items) ? items : [];
    } catch {
        return [];
    }
}

function writeOutbox(items: OutboxItem[]): void {
    try {
        if (items.length) localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
        else localStorage.removeItem(OUTBOX_KEY);
    } catch {
        // ignore
    }
}

async function post(item: OutboxItem): Promise<Response> {
    const { queued_at: _queuedAt, ...body } = item;
    void _queuedAt;
    return fetch('/api/v1/feedback', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify(body),
    });
}

/** Send feedback now, or keep it to send automatically once the server is reachable. */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackResult> {
    const item: OutboxItem = { ...payload, client_id: crypto.randomUUID() };

    if (navigator.onLine) {
        try {
            const res = await post(item);
            const data = await res.json().catch(() => null);
            if (res.ok) return { status: 'sent', message: data?.message };
            if (res.status === 422) {
                return { status: 'rejected', error: data?.message || 'Please check your feedback and try again.' };
            }
        } catch {
            // Network failure: keep it below.
        }
    }

    writeOutbox([...readOutbox(), { ...item, queued_at: new Date().toISOString() }]);
    return { status: 'queued' };
}

/** Resend kept feedback, oldest first. Stops at the first connection problem. */
export async function flushFeedbackOutbox(): Promise<number> {
    const items = readOutbox().map((i) => ({ ...i, client_id: i.client_id ?? crypto.randomUUID() }));
    writeOutbox(items); // persist ids given to legacy items, so their resends dedupe too
    let sent = 0;

    while (items.length) {
        let res: Response;
        try {
            res = await post(items[0]);
        } catch {
            break;
        }
        if (res.status >= 500 || res.status === 429) break;
        // Delivered, or rejected as invalid (it can never succeed): either way it's done.
        items.shift();
        writeOutbox(items);
        if (res.ok) sent++;
    }
    return sent;
}
