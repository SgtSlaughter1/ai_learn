import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { startAutoSync } from './services/SyncService';

const appName = import.meta.env.VITE_APP_NAME || 'Offline AI Learning Platform';

// Handle offline navigation for Inertia.js:
// The Service Worker caches both Inertia JSON and full HTML views.
// Client-side Inertia transitions work smoothly offline from the SW cache.


// 2. 'invalid' fires if SW returns cached HTML for an XHR request.
router.on('invalid', (event) => {
    event.preventDefault();
    const response = (event.detail as any)?.response;
    const targetUrl = response?.config?.url || response?.url;
    if (targetUrl && targetUrl !== window.location.href && !targetUrl.startsWith('/api/')) {
        if (navigator.onLine) {
            window.location.href = targetUrl;
            return false;
        }
        if ('caches' in window) {
            caches.match(targetUrl).then((cached) => {
                if (cached) window.location.href = targetUrl;
            });
        }
    }
    return true;
});

// 3. 'exception' fires if a network error occurred during an in-flight visit.
//    We prevent Safari from dumping the entire SPA when offline.
router.on('exception', (event) => {
    const exception = (event.detail as any)?.exception;
    const isNetworkError = !exception?.response || exception?.message === 'Network Error' || exception?.code === 'ERR_NETWORK';

    if (isNetworkError) {
        event.preventDefault();
        const targetUrl = exception?.config?.url;
        if (targetUrl && targetUrl !== window.location.href && !targetUrl.startsWith('/api/')) {
            if (navigator.onLine) {
                window.location.href = targetUrl;
                return false;
            }
            if ('caches' in window) {
                caches.match(targetUrl).then((cached) => {
                    if (cached) window.location.href = targetUrl;
                });
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
