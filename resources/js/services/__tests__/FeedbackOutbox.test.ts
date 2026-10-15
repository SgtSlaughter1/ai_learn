import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushFeedbackOutbox, submitFeedback } from '../FeedbackOutbox';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
});
const onLine = { value: true };
vi.stubGlobal('navigator', { get onLine() { return onLine.value; } });

const outbox = () => JSON.parse(store.get('offline_feedbacks') || '[]');
const respond = (status: number) => Promise.resolve(new Response(JSON.stringify({}), { status }));

beforeEach(() => {
    store.clear();
    onLine.value = true;
});

describe('FeedbackOutbox', () => {
    it('keeps feedback written offline, with an id for de-duplication', async () => {
        onLine.value = false;
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        expect(await submitFeedback({ message: 'Works offline!' })).toEqual({ status: 'queued' });
        expect(fetchMock).not.toHaveBeenCalled();
        expect(outbox()).toHaveLength(1);
        expect(outbox()[0].client_id).toMatch(/[0-9a-f-]{36}/);
    });

    it('keeps feedback when the server is unreachable, and returns validation errors', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
        expect((await submitFeedback({ message: 'hello' })).status).toBe('queued');

        vi.stubGlobal('fetch', vi.fn(() => respond(422)));
        expect((await submitFeedback({ message: 'x' })).status).toBe('rejected');
        expect(outbox()).toHaveLength(1);
    });

    it('sends kept items in order, including ones saved by older app versions', async () => {
        store.set('offline_feedbacks', JSON.stringify([{ message: 'legacy item' }, { message: 'second', client_id: 'abc' }]));
        const fetchMock = vi.fn(() => respond(201));
        vi.stubGlobal('fetch', fetchMock);

        expect(await flushFeedbackOutbox()).toBe(2);
        expect(outbox()).toHaveLength(0);
        const sentBodies = fetchMock.mock.calls.map((c: any[]) => JSON.parse(c[1].body));
        expect(sentBodies[0].client_id).toBeTruthy(); // legacy item was given an id before sending
        expect(sentBodies[1].client_id).toBe('abc');
    });

    it('stops at the first connection problem and keeps the rest', async () => {
        store.set('offline_feedbacks', JSON.stringify([{ message: 'a', client_id: '1' }, { message: 'b', client_id: '2' }]));
        vi.stubGlobal('fetch', vi.fn()
            .mockImplementationOnce(() => respond(201))
            .mockImplementationOnce(() => respond(503)));

        expect(await flushFeedbackOutbox()).toBe(1);
        expect(outbox().map((i: any) => i.client_id)).toEqual(['2']);
    });
});
