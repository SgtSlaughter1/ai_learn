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
            injectRegister: 'auto',
            scope: '/',
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                modifyURLPrefix: {
                    'assets/': '/build/assets/',
                    'registerSW.js': '/registerSW.js',
                    'manifest.webmanifest': '/manifest.webmanifest',
                },
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                skipWaiting: true,
                navigateFallback: null,
                runtimeCaching: [
                    {
                        // 1. Cache app routes (HTML + Inertia XHR) — MUST be first
                        // Pre-warmed as plain HTML (200 OK), served from cache when offline
                        // ignoreVary is critical: Inertia adds Vary: X-Inertia to responses,
                        // which would cause cache misses when XHR requests have X-Inertia header
                        urlPattern: ({ url, request }) => {
                            const isAppRoute = /^\/(dashboard|subjects|quizzes|flashcards)(\/.*)?$/.test(url.pathname);
                            return isAppRoute && !request.headers.has('X-Inertia');
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
                        },
                    },
                    {
                        // 2. Catch-all for other HTML navigation requests
                        urlPattern: ({ request }) => request.mode === 'navigate',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'pages-cache',
                            networkTimeoutSeconds: 3,
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                    {
                        // 3. Cache images and icons in /images/
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
                name: 'Offline AI Learning Platform',
                short_name: 'OfflineAI',
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
