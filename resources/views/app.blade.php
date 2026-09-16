<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#183B2B">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="AILEARN">
        <meta name="description" content="AILEARN — Offline-First Adaptive AI Learning Platform for Learners.">

        <title inertia>{{ config('app.name', 'AILEARN') }}</title>

        <!-- Favicons -->
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png">
        <link rel="shortcut icon" href="/favicon.ico">

        <!-- PWA Manifest -->
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">

        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
        {{-- PWA Service Worker Registration
             vite-plugin-pwa generates the SW at /build/sw.js with a Service-Worker-Allowed: /
             header served via our Laravel route, so it can control the full / scope.
             We do NOT use /sw.js (the old manual route) to avoid double-registration.
        --}}
        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    // Register SW from /sw.js (root path) so it naturally controls
                    // the full / scope without needing Service-Worker-Allowed header.
                    // The /build/sw.js path requires that header which PHP dev server strips.
                    navigator.serviceWorker.register('/sw.js', { scope: '/' })
                        .then((reg) => {
                            console.log('[SW] ServiceWorker registered, scope:', reg.scope);
                            reg.addEventListener('updatefound', () => {
                                const newWorker = reg.installing;
                                if (newWorker) {
                                    newWorker.addEventListener('statechange', () => {
                                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                            console.log('[SW] New SW installed, will activate on next load');
                                        }
                                    });
                                }
                            });
                        })
                        .catch((err) => {
                            console.error('[SW] ServiceWorker registration failed:', err);
                        });

                    // When a new SW activates and claims clients, reload once while online
                    // so the open tab does not attempt to request orphaned chunk hashes
                    let refreshing = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (!refreshing && navigator.onLine) {
                            refreshing = true;
                            window.location.reload();
                        }
                    });
                });
            }
        </script>
    </body>
</html>
