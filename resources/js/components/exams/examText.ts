/** Dates and times as exam lists show them, in the device's own time zone. */
export function formatWhen(iso: string): string {
    return new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** 754 → "12:34"; an hour or more → "1:02:03". */
export function formatClock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

/** The value a datetime-local input wants, from an ISO time. */
export function toLocalInput(iso: string | Date): string {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The message a failed JSON request carries, or a fallback. */
export async function errorMessage(res: Response, fallback: string): Promise<string> {
    const data = await res.json().catch(() => null);
    if (data?.errors && typeof data.errors === 'object') {
        const first = Object.values(data.errors).flat()[0];
        if (typeof first === 'string') return first;
    }
    return data?.message || fallback;
}

export const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };
