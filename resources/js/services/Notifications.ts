import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';

/**
 * The bell's data. Every page visit brings the unread count with it (an Inertia shared prop), so
 * this only asks the server between visits: every 5 minutes while the tab is in view, every 15
 * while it is in the background, never while offline. A new notification also shows a browser
 * pop-up when the person has turned pop-ups on; the pop-up text is general (no names or scores).
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

/**
 * Pop-ups on this device: 'on' or 'off' (the person's choice in their profile), 'ask' (not
 * decided yet), 'blocked' (the browser refuses them) or 'unsupported'. A browser can't take
 * permission back from a page, so turning them off is remembered here instead.
 */
export type PopUpState = 'on' | 'off' | 'ask' | 'blocked' | 'unsupported';

export const POPUPS_CHANGED_EVENT = 'popups-changed';

const choiceKey = (userId: string | number | undefined) => `popups:${userId ?? ''}`;
const askedKey = (userId: string | number | undefined) => `popups-asked:${userId ?? ''}`;

export function popUpState(userId: string | number | undefined): PopUpState {
    const permission = popUpPermission();
    if (permission === 'unsupported') return 'unsupported';
    if (permission === 'denied') return 'blocked';
    if (stored(choiceKey(userId)) === 'off') return 'off';
    return permission === 'granted' ? 'on' : 'ask';
}

/** Whether the first-time question about pop-ups was already answered on this device. */
export function popUpsAsked(userId: string | number | undefined): boolean {
    return stored(askedKey(userId)) !== null;
}

export function markPopUpsAsked(userId: string | number | undefined) {
    stored(askedKey(userId), new Date().toISOString());
}

export async function setPopUps(userId: string | number | undefined, on: boolean): Promise<PopUpState> {
    markPopUpsAsked(userId);
    if (on && popUpPermission() === 'default') await Notification.requestPermission();
    stored(choiceKey(userId), on ? 'on' : 'off');
    const state = popUpState(userId);
    window.dispatchEvent(new Event(POPUPS_CHANGED_EVENT));
    return state;
}

/** The pop-up setting, kept in step across the profile, the first-time question and other tabs. */
export function usePopUpSetting(userId: string | number | undefined) {
    const [state, setState] = useState<PopUpState>(() => popUpState(userId));
    useEffect(() => {
        const sync = () => setState(popUpState(userId));
        sync();
        window.addEventListener(POPUPS_CHANGED_EVENT, sync);
        window.addEventListener('storage', sync);
        window.addEventListener('focus', sync);
        return () => {
            window.removeEventListener(POPUPS_CHANGED_EVENT, sync);
            window.removeEventListener('storage', sync);
            window.removeEventListener('focus', sync);
        };
    }, [userId]);
    const change = useCallback(async (on: boolean) => setState(await setPopUps(userId, on)), [userId]);
    return { state, turnOn: () => change(true), turnOff: () => change(false) };
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
                if (seen && popUpState(userId) === 'on') void popUp(latest);
            }
        },
        [seenKey, userId]
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

    return { summary, setSummary: apply };
}
