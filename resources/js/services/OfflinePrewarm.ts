import { homePathsForRole, saveSnapshot, type AuthUser } from './OfflineNavigation';
import { preloadFullOfflineCurriculum, runPreloadSteps } from './OfflineService';
import { staffPreloadSteps } from './AdminOfflineService';

/**
 * Keeps what the device needs to open the app offline up to date, while online:
 *  - the "app shell": one full HTML page the service worker serves for any page
 *    opened or refreshed offline (the app then renders the requested page itself);
 *  - snapshots of the server data for the pages the user's role starts on.
 *
 * Names must match the navigation handler in vite.config.ts.
 */
export const APP_SHELL_CACHE = 'app-shell';
export const APP_SHELL_KEY = '/__app-shell';

let prewarmedFor: string | null = null;

/**
 * Store a fresh shell. Called on every online start, so the shell always references the
 * current build's scripts (an outdated shell would point at files a new version removed).
 */
export async function refreshAppShell(user: AuthUser | null): Promise<void> {
    if (typeof caches === 'undefined') return;
    const path = user ? homePathsForRole(user.role)[0] : '/login';

    try {
        const res = await fetch(path, {
            credentials: 'same-origin',
            headers: { Accept: 'text/html' },
            cache: 'no-store',
        });
        const isHtml = (res.headers.get('Content-Type') || '').includes('text/html');
        // A signed-in user being redirected to /login means the session ended: keep the old shell.
        const bouncedToLogin = Boolean(user) && new URL(res.url).pathname === '/login';
        if (!res.ok || !isHtml || bouncedToLogin) return;

        const cache = await caches.open(APP_SHELL_CACHE);
        await cache.put(APP_SHELL_KEY, res);
    } catch {
        // Offline or server error: the previous shell stays in place.
    }
}

/** Save server data for the pages this role lands on, so they open offline straight away. */
export async function prewarmPagesForUser(user: AuthUser, inertiaVersion: string | null | undefined): Promise<void> {
    if (prewarmedFor === user.id) return;
    prewarmedFor = user.id;

    const headers: Record<string, string> = {
        'X-Inertia': 'true',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'text/html, application/xhtml+xml',
    };
    if (inertiaVersion) headers['X-Inertia-Version'] = inertiaVersion;

    await Promise.allSettled(
        homePathsForRole(user.role).map(async (path) => {
            const res = await fetch(path, { credentials: 'same-origin', headers });
            // 409 = a new app version is deployed; the next page load picks it up.
            if (!res.ok || res.headers.get('X-Inertia') !== 'true') return;
            await saveSnapshot(await res.json());
        })
    );
}

/** Caches written by earlier app versions that mixed pages and page data; no longer used. */
export async function removeLegacyCaches(): Promise<void> {
    if (typeof caches === 'undefined') return;
    await Promise.all(['app-routes-cache', 'pages-cache'].map((name) => caches.delete(name).catch(() => false)));
}

export function resetPrewarm(): void {
    prewarmedFor = null;
}

const STAFF_DETAIL = 'Your school\'s classes, learners, subjects and question bank are saved on this device. Changes you make offline sync automatically when you reconnect.';

/**
 * Download what this user needs to keep working offline, with progress shown in the
 * header badge: learners get their curriculum and past questions; teachers and admins
 * get their school's records, picked from the abilities the server granted.
 */
export function prepareOfflineData(role: string | undefined, can: Record<string, boolean> | null | undefined): void {
    if (role === 'learner' || !can?.accessTeaching) {
        void preloadFullOfflineCurriculum();
        return;
    }
    void runPreloadSteps(staffPreloadSteps(can, role === 'teacher'), 'School data saved', STAFF_DETAIL);
}

