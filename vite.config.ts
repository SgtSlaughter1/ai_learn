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
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf}'],
                // Also precache the offline fallback page from public/
                additionalManifestEntries: [
                    { url: '/offline.html', revision: '2' },
                    { url: '/images/icon-144x144.png', revision: '1' },
                    { url: '/images/icon-192x192.png', revision: '1' },
                    { url: '/images/icon-512x512.png', revision: '1' },
                    { url: '/images/apple-touch-icon.png', revision: '1' },
                    { url: '/images/favicon-32x32.png', revision: '1' },
                    { url: '/images/favicon-16x16.png', revision: '1' },
                    { url: '/favicon.ico', revision: '1' },
                    { url: '/images/screenshot-desktop.png', revision: '1' },
                    { url: '/images/screenshot-mobile.png', revision: '1' },
                ],
                modifyURLPrefix: {
                    // Map Vite's output paths to the actual served paths
                    'assets/': '/build/assets/',
                },
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                // No navigateFallback here — we handle offline navigation via
                // the runtimeCaching NetworkFirst rules below which check the
                // cache before giving up. offline.html is only shown when
                // nothing is cached AND network fails.
                navigateFallback: null,
                runtimeCaching: [
                    {
                        // 1. Cache app routes (both HTML and Inertia JSON) — covers all main nav pages
                        // ignoreVary is critical: Inertia adds Vary: X-Inertia to responses
                        urlPattern: ({ url }) => {
                            return /^\/(dashboard|admin|teacher|subjects|quizzes|flashcards|login|)(\/.*)?$/.test(url.pathname);
                        },
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'app-routes-cache',
                            networkTimeoutSeconds: 3,
                            matchOptions: {
                                ignoreVary: true,
                                ignoreSearch: true,
                            },
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 14 * 24 * 60 * 60, // 14 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            plugins: [
                                {
                                    handlerDidError: async ({ request }) => {
                                        const isInertia = request?.headers?.get('X-Inertia') === 'true' || request?.headers?.get('x-inertia') === 'true';
                                        const url = request?.url ? new URL(request.url) : null;
                                        if (isInertia && url) {
                                            const p = url.pathname;
                                            let component = 'Dashboard';
                                            if (p === '/' || p === '') component = 'Welcome';
                                            else if (p === '/login') component = 'auth/Login';
                                            else if (p.startsWith('/admin')) component = 'admin/Dashboard';
                                            else if (p.startsWith('/teacher')) component = 'teacher/Dashboard';
                                            else if (p === '/subjects') component = 'Subjects/Index';
                                            else if (p.startsWith('/subjects/')) component = 'Subjects/Show';
                                            else if (p.startsWith('/quizzes/attempts/')) component = 'quizzes/Result';
                                            else if (p.startsWith('/quizzes/')) component = 'quizzes/Show';
                                            else if (p.startsWith('/flashcards')) component = 'Flashcards/Index';

                                            const inertiaPayload = {
                                                component: component,
                                                props: {
                                                    auth: { user: null },
                                                    errors: {}
                                                },
                                                url: p,
                                                version: ''
                                            };

                                            return new Response(JSON.stringify(inertiaPayload), {
                                                status: 200,
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'X-Inertia': 'true',
                                                }
                                            });
                                        }

                                        const offlinePage = await caches.match('/offline.html');
                                        return offlinePage || Response.error();
                                    }
                                }
                            ],
                        },
                    },
                    {
                        // 2. Catch-all for ALL HTML navigation requests
                        // NetworkFirst: tries network (3s timeout), falls back to cache,
                        // and if nothing cached serves /offline.html
                        urlPattern: ({ request }) => request.mode === 'navigate',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'pages-cache',
                            networkTimeoutSeconds: 3,
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 30 * 24 * 60 * 60,
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                            plugins: [
                                {
                                    // When both network and cache fail, serve the offline page
                                    handlerDidError: async () => {
                                        const offlinePage = await caches.match('/offline.html');
                                        return offlinePage || Response.error();
                                    }
                                }
                            ],
                        },
                    },
                    {
                        // 3. Cache built JS/CSS/asset chunks (CacheFirst)
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
                        // 4. Cache API calls for offline fallback
                        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
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
                        src: '/images/icon-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'maskable'
                    },
                    {
                        src: '/images/icon-512x512.png',
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
