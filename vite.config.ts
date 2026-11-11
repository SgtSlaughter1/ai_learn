import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            // 'null' because we register the SW manually in app.blade.php
            // to avoid double-registration conflicts
            injectRegister: null,
            scope: '/',
            workbox: {
                // Opens the right page when a staff member clicks a review pop-up.
                importScripts: ['/sw-notifications.js'],
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
                // Also precache the offline fallback page from public/
                additionalManifestEntries: [
                    { url: '/offline.html', revision: '2' },
                    { url: '/images/icon-144x144.png', revision: '2' },
                    { url: '/images/icon-192x192.png', revision: '2' },
                    { url: '/images/icon-512x512.png', revision: '2' },
                    { url: '/images/apple-touch-icon.png', revision: '2' },
                    { url: '/images/favicon-32x32.png', revision: '2' },
                    { url: '/images/favicon-16x16.png', revision: '2' },
                    { url: '/favicon.ico', revision: '2' },
                    { url: '/images/favicon.svg', revision: '1' },
                    { url: '/images/maskable-512x512.png', revision: '1' },
                    { url: '/images/screenshot-desktop.png', revision: '2' },
                    { url: '/images/screenshot-mobile.png', revision: '2' },
                ],
                modifyURLPrefix: {
                    // Map Vite's output paths to the actual served paths
                    'assets/': '/build/assets/',
                },
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                // No navigateFallback: the navigation handler below serves the app shell
                // (or offline.html) when the network is unavailable.
                navigateFallback: null,
                runtimeCaching: [
                    // Inertia page visits (X-Inertia XHRs) are deliberately NOT cached here:
                    // when one can't reach the server the app renders the page on the device
                    // from local data (resources/js/services/OfflineNavigation.ts).
                    {
                        // 1. Full page loads (open, refresh, typed URL).
                        // Online: always the live page, never cached (a cached page could be
                        // stale, belong to another user, or reference scripts from an old build).
                        // Offline: the "app shell" saved by the app (OfflinePrewarm.ts), which
                        // then renders the requested URL itself; else /offline.html.
                        urlPattern: ({ request }) => request.mode === 'navigate',
                        handler: async ({ request }) => {
                            if (new URL(request.url).pathname === '/offline.html') {
                                return (await caches.match('/offline.html', { ignoreSearch: true })) || fetch(request);
                            }
                            try {
                                const controller = new AbortController();
                                const timer = setTimeout(() => controller.abort(), 8000);
                                const response = await fetch(request, { signal: controller.signal });
                                clearTimeout(timer);
                                return response;
                            } catch {
                                const shellCache = await caches.open('app-shell');
                                const shell = await shellCache.match('/__app-shell');
                                if (shell) return shell;
                                const offlinePage = await caches.match('/offline.html', { ignoreSearch: true });
                                return offlinePage || Response.error();
                            }
                        },
                    },
                    {
                        // 2. Cache built JS/CSS/asset chunks (CacheFirst)
                        urlPattern: ({ url }) => url.pathname.startsWith('/build/assets/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'build-assets-cache',
                            expiration: {
                                maxEntries: 300,
                                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // Question and passage pictures uploaded by teachers (/storage/questions/…).
                        // OfflineService.precacheQuizImages fills this when a quiz is saved.
                        urlPattern: ({ url }) => url.pathname.startsWith('/storage/'),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'question-images',
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 24 * 60 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // 4. Cache images and icons in /images/
                        urlPattern: ({ url }) => url.pathname.startsWith('/images/'),
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 60,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // 3. Cache API calls for offline fallback.
                        // Sync endpoints are excluded: a cached session check would make the
                        // sync engine think it is online and signed in when it is not.
                        // Admin endpoints are excluded too: AdminOfflineService keeps their offline
                        // copy, and on a slow server this cache's 3s fallback served stale lists
                        // right after an edit (and kept staff-only answers in the HTTP cache).
                        urlPattern: ({ url }) => url.pathname.startsWith('/api/')
                            && !url.pathname.startsWith('/api/v1/sync/')
                            && !url.pathname.startsWith('/api/v1/admin/'),
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            networkTimeoutSeconds: 3,
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 7 * 24 * 60 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
            manifest: {
                id: '/',
                name: 'AceDrill',
                short_name: 'AceDrill',
                description: 'An offline-first adaptive AI learning platform.',
                theme_color: '#183B2B',
                background_color: '#F7F4EC',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: '/images/icon-144x144.png',
                        sizes: '144x144',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/images/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        src: '/images/icon-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any'
                    },
                    {
                        // Full-bleed tile with the mark inside the 80 % safe zone, so Android's mask never clips it.
                        src: '/images/maskable-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable'
                    }
                ],
                screenshots: [
                    {
                        src: '/images/screenshot-desktop.png',
                        sizes: '1280x720',
                        type: 'image/png',
                        form_factor: 'wide',
                        label: 'Dashboard - Desktop View'
                    },
                    {
                        src: '/images/screenshot-mobile.png',
                        sizes: '750x1334',
                        type: 'image/png',
                        form_factor: 'narrow',
                        label: 'Dashboard - Mobile View'
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            '@': '/resources/js',
        },
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
