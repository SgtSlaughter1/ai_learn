import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';

/**
 * The bell's data. Every page visit brings the unread count with it (an Inertia shared prop), so
 * this only asks the server between visits: every 5 minutes while the tab is in view, every 15
 * while it is in the background, never while offline. A new notification also shows a browser
 * pop-up once the person has allowed them; the pop-up text is general (no names or scores).
 */

/** Sent after something that changes the counts (a review, reading a notification). */
export const NOTIFICATIONS_CHANGED_EVENT = 'notifications-changed';
/** Sent when the count of reported explanations changes, so an open review queue reloads. */
export const REVIEWS_UPDATED_EVENT = 'ai-reviews-updated';

const VISIBLE_CHECK_MS = 5 * 60 * 1000;
const HIDDEN_CHECK_MS = 15 * 60 * 1000;
/** Coming back to the tab or online checks again, but never more than once a minute. */
const MIN_GAP_MS = 60 * 1000;

export interface NotificationSummary {
    unread: number;
    reviews: number;
    latest: { id: string; at: string | null; title: string; body: string; url: string } | null;
}

export type PopUpPermission = NotificationPermission | 'unsupported';

function stored(key: string, value?: string): string | null {
    try {
        if (value === undefined) return localStorage.getItem(key);
        localStorage.setItem(key, value);
    } catch {
        // Private mode or blocked storage: a pop-up may repeat, nothing worse.
    }
    return null;
}

export function popUpPermission(): PopUpPermission {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

async function popUp(latest: NonNullable<NotificationSummary['latest']>) {
    const options: NotificationOptions = {
        body: latest.body,
        tag: `acedrill-${latest.id}`,
        icon: '/images/icon-192x192.png',
        badge: '/images/icon-144x144.png',
        data: { url: latest.url },
    };
    try {
        // Phones only show pop-ups through the service worker.
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration) {
            await registration.showNotification(latest.title, options);
            return;
        }
        const notification = new Notification(latest.title, options);
        notification.onclick = () => {
            window.focus();
            window.location.href = latest.url;
        };
    } catch {
        // The bell still shows it.
    }
}

export function useNotifications(userId: string | number | undefined) {
    const shared = (usePage().props as { notifications?: NotificationSummary | null }).notifications ?? null;
    const [summary, setSummary] = useState<NotificationSummary | null>(shared);
    const [permission, setPermission] = useState<PopUpPermission>(popUpPermission);
    const lastReviews = useRef<number | null>(shared?.reviews ?? null);
    const seenKey = `notification-popped:${userId ?? ''}`;
    const enabled = userId !== undefined && userId !== null;

    const apply = useCallback(
        (next: NotificationSummary) => {
            setSummary(next);
            if (lastReviews.current !== null && lastReviews.current !== next.reviews) {
                window.dispatchEvent(new CustomEvent(REVIEWS_UPDATED_EVENT, { detail: next }));
            }
            lastReviews.current = next.reviews;

            // One pop-up per new notification, across tabs and visits.
            const latest = next.latest;
            const seen = stored(seenKey);
            if (latest?.at && (!seen || latest.at > seen)) {
                stored(seenKey, latest.at);
                // The first check on a device only records where things stand.
                if (seen && popUpPermission() === 'granted') void popUp(latest);
            }
        },
        [seenKey]
    );

    // A page visit brought a fresh count.
    useEffect(() => {
        if (shared) apply(shared);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shared?.unread, shared?.reviews, shared?.latest?.id, shared?.latest?.at]);

    const lastCheck = useRef(Date.now());
    const check = useCallback(async (force = false) => {
        if (!enabled || !navigator.onLine) return;
        if (!force && Date.now() - lastCheck.current < MIN_GAP_MS) return;
        lastCheck.current = Date.now();
        try {
            const res = await fetch('/api/v1/notifications/summary', { headers: { Accept: 'application/json' } });
            if (res.ok) apply(await res.json());
        } catch {
            // Offline or a server error: try again next time.
        }
    }, [enabled, apply]);

    useEffect(() => {
        if (!enabled) return;
        let timer: number | undefined;
        const schedule = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(async () => {
                await check(true);
                schedule();
            }, document.visibilityState === 'visible' ? VISIBLE_CHECK_MS : HIDDEN_CHECK_MS);
        };
        const onVisible = () => {
            if (document.visibilityState === 'visible') void check();
            schedule();
        };
        const onOnline = () => void check();
        const onChanged = () => void check(true);
        schedule();
        window.addEventListener('online', onOnline);
        window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('online', onOnline);
            window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [enabled, check]);

    const enablePopUps = useCallback(async () => {
        if (popUpPermission() === 'unsupported') return;
        setPermission(await Notification.requestPermission());
    }, []);

    return { summary, setSummary: apply, permission, enablePopUps };
}
