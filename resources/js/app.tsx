import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

const appName = import.meta.env.VITE_APP_NAME || 'Offline AI Learning Platform';

// Handle offline navigation for Inertia.js:
//
// 1. 'before' fires BEFORE any visit starts. When offline, cancel the Inertia AJAX
//    visit (which would fail with ERR_INTERNET_DISCONNECTED) and do a standard browser
//    navigation. The Service Worker intercepts it and serves the cached HTML page.
router.on('before', (event) => {
    if (!navigator.onLine) {
        const visit = (event.detail as any)?.visit;
        const targetUrl = visit?.url?.href || visit?.url;
        if (targetUrl) {
            event.preventDefault();
            window.location.href = targetUrl;
            return false;
        }
    }
    return true;
});

// 2. 'invalid' fires if SW returns cached HTML for an XHR request.
//    We redirect to the target URL to load the HTML layout properly.
router.on('invalid', (event) => {
    event.preventDefault();
    const response = (event.detail as any)?.response;
    const targetUrl = response?.config?.url || response?.url;
    if (targetUrl && targetUrl !== window.location.href) {
        window.location.href = targetUrl;
        return false;
    }
    return true;
});

// 3. 'exception' fires if a network error occurred during an in-flight visit.
//    We catch any network connection failure (Axios Network Error / no response)
//    and perform standard navigation to fall back to the Service Worker cache.
router.on('exception', (event) => {
    const exception = (event.detail as any)?.exception;
    const isNetworkError = !exception?.response || exception?.message === 'Network Error' || exception?.code === 'ERR_NETWORK';

    if (isNetworkError) {
        event.preventDefault();
        const targetUrl = exception?.config?.url;
        if (targetUrl && targetUrl !== window.location.href) {
            window.location.href = targetUrl;
            return false;
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
    },
    progress: {
        color: '#183B2B',
    },
});
