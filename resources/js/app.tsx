import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { startAutoSync } from './services/SyncService';
import { setSyncUser } from './services/SyncQueue';
import { cacheUserProfile } from './services/OfflineService';
import {
    buildOfflinePage,
    OFFLINE_PROP,
    rememberAuthUser,
    renderOfflinePage,
    saveSnapshot,
    type AuthUser,
} from './services/OfflineNavigation';
import { prewarmPagesForUser, refreshAppShell, removeLegacyCaches } from './services/OfflinePrewarm';
import { reportServerReachable } from './services/Connectivity';
import { GlobalNotices, OFFLINE_ACTION_BLOCKED_EVENT } from './components/sync/GlobalNotices';

const appName = import.meta.env.VITE_APP_NAME || 'AceDrill';


// ── Offline navigation ──
//
// Page visits that can't reach the server are rendered on the device (see
// OfflineNavigation.ts) instead of reloading into the service worker. Form posts
// that can't reach the server are reported, never turned into page reloads.

let lastVisit: { url: string; method: string } | null = null;

/** Show a page offline, or the offline notice when this URL can't be shown offline. */
async function showOffline(url: string): Promise<void> {
    if (!(await renderOfflinePage(url))) {
        window.location.assign('/offline.html');
    }
}

function reportBlockedAction(): void {
    // Shown by <GlobalNotices />.
    window.dispatchEvent(new CustomEvent(OFFLINE_ACTION_BLOCKED_EVENT));
}

router.on('before', (event) => {
    const visit = event.detail.visit;
    lastVisit = { url: visit.url.href, method: visit.method };

    if (navigator.onLine || visit.prefetch) return;

    // Known offline: skip the request entirely instead of waiting for it to fail.
    event.preventDefault();
    if (visit.method !== 'get') {
        reportBlockedAction();
    } else if (!visit.only?.length && !visit.except?.length) {
        // (Partial reloads just keep the current data.)
        void showOffline(visit.url.href);
    }
    return false;
});

router.on('exception', (event) => {
    const exception = event.detail.exception as { response?: unknown } | undefined;
    // Only connection failures are handled here; real server errors keep Inertia's default.
    if (exception?.response || !lastVisit) return;

    event.preventDefault();
    reportServerReachable(false);
    if (lastVisit.method === 'get') {
        void showOffline(lastVisit.url);
    } else {
        reportBlockedAction();
    }
    return false;
});

// ── Signed-in user & page snapshots ──

// Only real server pages are trusted to say who is signed in; pages built on the device
// reuse the remembered user and must not overwrite it (sign-out clears it explicitly).
let preparedForUserId: string | null | undefined;

/**
 * Refresh the app shell and the role's page data whenever a different user is seen
 * (first load, and right after signing in, which is an in-app navigation).
 */
function prepareOfflineFor(user: AuthUser | null, inertiaVersion: string | undefined): void {
    const id = user?.id ?? null;
    if (!navigator.onLine || preparedForUserId === id) return;
    preparedForUserId = id;
    void refreshAppShell(user);
    if (user) void prewarmPagesForUser(user, inertiaVersion);
}

function rememberServerPage(page: any): void {
    if (!page || page.props?.[OFFLINE_PROP]) return;
    reportServerReachable(true);

    void saveSnapshot(page);

    const user = page.props?.auth?.user as AuthUser | null | undefined;
    const authUser: AuthUser | null = user?.id ? { ...user, id: String(user.id) } : null;
    prepareOfflineFor(authUser, page.version);
    if (!authUser) return;
    rememberAuthUser(authUser);
    setSyncUser(authUser.id);
    cacheUserProfile({
        id: authUser.id,
        name: authUser.name,
        email: authUser.email,
        role: authUser.role,
        cached_at: new Date().toISOString(),
    }).catch(() => {});
}

router.on('navigate', (event) => {
    rememberServerPage((event.detail as any)?.page);
});

// ── Boot ──

function readServerPage(): any {
    try {
        const script = document.querySelector('script[data-page="app"][type="application/json"]');
        const raw = script?.textContent || document.getElementById('app')?.getAttribute('data-page');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

async function boot(): Promise<void> {
    const serverPage = readServerPage();
    const here = window.location.pathname + window.location.search;
    let initialPage = serverPage;

    // Opened offline: the service worker served the cached app shell, whose page is
    // some other URL. Build the page that was actually requested on the device.
    if (serverPage && serverPage.url !== here) {
        const offlinePage = await buildOfflinePage(window.location.href);
        if (!offlinePage) {
            window.location.replace('/offline.html');
            return;
        }
        initialPage = { ...serverPage, ...offlinePage };
    }

    await createInertiaApp({
        title: (title) => `${title} - ${appName}`,
        page: initialPage ?? undefined,
        resolve: (name) =>
            resolvePageComponent(
                `./pages/${name}.tsx`,
                import.meta.glob('./pages/**/*.tsx'),
            ),
        setup({ el, App, props }) {
            const root = createRoot(el);
            root.render(
                <>
                    <App {...props} />
                    <GlobalNotices />
                </>
            );

            // Boot background auto-sync: syncs offline data every 30s when online,
            // and immediately when connectivity is restored.
            startAutoSync(30000);
        },
        progress: {
            color: '#183B2B',
        },
    });

    if (initialPage === serverPage) {
        // Online start: also refreshes what the device needs to open the app offline.
        rememberServerPage(serverPage);
        if (navigator.onLine) void removeLegacyCaches();
    }
}

void boot();
