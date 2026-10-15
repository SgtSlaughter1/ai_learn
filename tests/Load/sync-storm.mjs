// 150 learners reconnect at once and sync an offline backlog in batches, then every
// device re-sends everything (as if all responses were lost). Node 22, no dependencies.
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8030';
const USERS = Number(process.env.USERS ?? 150);
const ATTEMPTS_PER_USER = Number(process.env.ATTEMPTS ?? 30);
const BATCH_SIZE = 25;
const JITTER_MS = Number(process.env.JITTER_MS ?? 0); // the app spreads reconnects over 20 s

class Client {
    constructor(email) { this.email = email; this.cookies = new Map(); }
    cookieHeader() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '); }
    store(res) {
        for (const c of res.headers.getSetCookie?.() ?? []) {
            const [pair] = c.split(';'); const i = pair.indexOf('=');
            this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
        }
    }
    async req(method, path, body) {
        const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: this.cookieHeader() };
        const xsrf = this.cookies.get('XSRF-TOKEN');
        if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const started = performance.now();
        const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
        this.store(res);
        const ms = performance.now() - started;
        const text = await res.text();
        let json = null; try { json = JSON.parse(text); } catch {}
        return { status: res.status, ms, json, text };
    }
    async login() {
        await this.req('GET', '/login');
        const r = await this.req('POST', '/login', { email: this.email, password: 'password' });
        if (r.status !== 200) throw new Error(`login ${this.email}: ${r.status} ${r.text.slice(0, 120)}`);
    }
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] : 0; };
const summary = (arr) => ({ n: arr.length, p50: Math.round(pct(arr, 50)), p95: Math.round(pct(arr, 95)), p99: Math.round(pct(arr, 99)), max: Math.round(Math.max(...arr)) });

// ── Setup: sign everyone in, load quiz content ──
const clients = Array.from({ length: USERS }, (_, i) => new Client(`load${i + 1}@loadtest.local`));
let t0 = performance.now();
for (let i = 0; i < clients.length; i += 25) await Promise.all(clients.slice(i, i + 25).map((c) => c.login()));
console.log(`signed in ${USERS} learners in ${Math.round(performance.now() - t0)} ms`);

const quizzes = [];
for (let id = 1; id <= 10; id++) {
    const r = await clients[0].req('GET', `/api/v1/quizzes/${id}`);
    if (r.status === 200) quizzes.push(r.json.quiz);
}
if (!quizzes.length) throw new Error('no quizzes');

function backlogFor() {
    const items = [];
    for (let i = 0; i < ATTEMPTS_PER_USER; i++) {
        const quiz = quizzes[i % quizzes.length];
        const id = randomUUID();
        items.push({
            key: `attempt-${id}`, method: 'POST', path: `/api/v1/quizzes/attempts/${id}/sync`,
            body: {
                quiz_id: quiz.id,
                answers: quiz.questions.map((q) => ({ question_id: q.id, selected_option_id: q.options[0]?.id ?? null })),
                duration_seconds: 300,
                completed_at: new Date(Date.now() - (ATTEMPTS_PER_USER - i) * 3_600_000).toISOString(),
            },
        });
    }
    for (let i = 0; i < 2; i++) items.push({ key: `flash-${randomUUID()}`, method: 'POST', path: '/api/v1/flashcards/complete', body: { ratings: ['easy', 'good', 'again', 'good'] } });
    items.push({ key: `revision-${randomUUID()}`, method: 'POST', path: '/api/v1/revision/complete-session', body: { completed_count: 5, correct_count: 3 } });
    return items;
}
const backlogs = clients.map(() => backlogFor());

// ── One sync pass: every device at once, batches in order per device ──
async function syncPass(label) {
    const batchMs = [], sessionMs = [], httpStatus = {}, itemStatus = {};
    let skippedForTime = 0;
    const started = performance.now();
    await Promise.all(clients.map(async (c, u) => {
        if (JITTER_MS) await new Promise((r) => setTimeout(r, Math.random() * JITTER_MS));
        const s = await c.req('GET', '/api/v1/sync/session');
        sessionMs.push(s.ms);
        // Like the app: send up to 25 at a time; changes skipped for time go in the next batch.
        let remaining = [...backlogs[u]];
        while (remaining.length) {
            const batch = remaining.slice(0, BATCH_SIZE);
            const r = await c.req('POST', '/api/v1/sync/batch', { items: batch });
            batchMs.push(r.ms);
            httpStatus[r.status] = (httpStatus[r.status] ?? 0) + 1;
            if (r.status !== 200) break;
            const done = new Set();
            for (const res of r.json?.results ?? []) {
                if (res.skipped) { skippedForTime += res.reason === 'time_budget' ? 1 : 0; continue; }
                itemStatus[res.status] = (itemStatus[res.status] ?? 0) + 1;
                done.add(res.key);
            }
            remaining = remaining.filter((it) => !done.has(it.key));
        }
    }));
    const total = performance.now() - started;
    console.log(`\n== ${label} ==`);
    console.log(`wall time: ${(total / 1000).toFixed(1)} s for ${USERS} devices, ${USERS * backlogs[0].length} changes`);
    console.log('session check ms:', summary(sessionMs));
    console.log('batch request ms:', summary(batchMs));
    console.log('batch HTTP status:', httpStatus);
    console.log('per-change status:', itemStatus, `(re-sent after time budget: ${skippedForTime})`);
}

const label = JITTER_MS ? `reconnect over ${JITTER_MS / 1000} s` : 'reconnect, all devices in the same second';
await syncPass(`${label}: ${USERS} devices x ${backlogs[0].length} changes`);
await syncPass('lost responses: every device re-sends the same backlog');
console.log(`\nEXPECTED new rows: attempts=${USERS * ATTEMPTS_PER_USER} flashcard_sessions=${USERS * 2} revision_sessions=${USERS}`);
