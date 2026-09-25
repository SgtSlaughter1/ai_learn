import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { startAutoSync } from './services/SyncService';

const appName = import.meta.env.VITE_APP_NAME || 'AceDrill';

// Handle offline navigation for Inertia.js:
// The Service Worker caches both Inertia JSON and full HTML views.
// Client-side Inertia transitions work smoothly offline from the SW cache.


// Helper to reliably extract the target navigation URL across Inertia v1 & v2 events
function extractTargetUrl(detail: any): string | null {
    if (!detail) return null;

    // 1. Inertia v2 RequestParams (URL object) or visit URL
    const requestUrl = detail.response?.requestParams?.all?.()?.url || detail.visit?.url;
    if (requestUrl) {
        return typeof requestUrl === 'string' ? requestUrl : requestUrl.href || requestUrl.pathname;
    }

    // 2. Underlying Axios response config / error config
    const axiosUrl =
        detail.response?.response?.config?.url ||
        detail.response?.config?.url ||
        detail.exception?.config?.url ||
        detail.response?.url;
    if (axiosUrl) {
        return axiosUrl;
    }

    return null;
}

// 2. 'invalid' fires if SW returns cached HTML for an XHR request (e.g. offline route fallback).
//    We redirect to the target URL to load the HTML layout properly.
router.on('invalid', (event) => {
    const detail = (event.detail as any);
    const targetUrl = extractTargetUrl(detail);

    if (targetUrl && !targetUrl.startsWith('/api/')) {
        event.preventDefault();
        if (targetUrl !== window.location.href) {
            window.location.href = targetUrl;
            return false;
        }
    }
    return true;
});

// 3. 'exception' fires if a network error occurred during an in-flight visit.
//    We catch network connection failures and perform standard navigation
//    so the Service Worker can serve cached pages or the offline fallback.
router.on('exception', (event) => {
    const detail = (event.detail as any);
    const exception = detail?.exception;
    const isNetworkError =
        !exception?.response ||
        exception?.message === 'Network Error' ||
        exception?.code === 'ERR_NETWORK';

    if (isNetworkError) {
        const targetUrl = extractTargetUrl(detail);
        if (targetUrl && !targetUrl.startsWith('/api/')) {
            event.preventDefault();
            if (targetUrl !== window.location.href) {
                window.location.href = targetUrl;
                return false;
            }
        }
    }
    return true;
});

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);
        root.render(<App {...props} />);

        // Boot background auto-sync: syncs offline data every 30s when online,
        // and immediately when connectivity is restored.
        startAutoSync(30000);
    },
    progress: {
        color: '#183B2B',
    },
});
