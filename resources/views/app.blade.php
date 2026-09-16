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
        <meta name="description" content="AILEARN is an offline-first adaptive AI learning platform. Study curriculum subjects, solve interactive practice problems with step-by-step explanations, and master topics without internet access.">
        <meta name="keywords" content="offline learning, AI tutor, secondary education, adaptive quiz, WAEC, NECO, curriculum, study companion, offline study app">
        <meta name="author" content="AILEARN Platform">
        <meta name="robots" content="index, follow">

        <title inertia>{{ config('app.name', 'AILEARN') }}</title>

        <!-- Canonical & Base Metadata -->
        <link rel="canonical" href="{{ url()->current() }}">

        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="AILEARN">
        <meta property="og:url" content="{{ url()->current() }}">
        <meta property="og:title" content="AILEARN — Offline-First Adaptive AI Learning Platform">
        <meta property="og:description" content="Master secondary school subjects offline with adaptive quizzes, smart flashcards, and an intelligent offline AI study companion.">
        <meta property="og:image" content="{{ asset('images/screenshot-desktop.png') }}">
        <meta property="og:image:width" content="1280">
        <meta property="og:image:height" content="720">
        <meta property="og:image:alt" content="AILEARN Adaptive Learning Dashboard">
        <meta property="og:locale" content="en_US">

        <!-- Twitter / X Cards -->
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="AILEARN — Offline-First Adaptive AI Learning Platform">
        <meta name="twitter:description" content="Master secondary school subjects offline with adaptive quizzes, smart flashcards, and an intelligent offline AI study companion.">
        <meta name="twitter:image" content="{{ asset('images/screenshot-desktop.png') }}">

        <!-- Schema.org JSON-LD Structured Data (EducationalOrganization, WebSite & WebApplication) -->
        <script type="application/ld+json">
        {
            "@@context": "https://schema.org",
            "@@graph": [
                {
                    "@@type": "EducationalOrganization",
                    "@@id": "{{ url('/') }}/#organization",
                    "name": "AILEARN",
                    "url": "{{ url('/') }}",
                    "logo": "{{ asset('images/icon-512x512.png') }}",
                    "description": "AILEARN is an offline-first adaptive learning platform empowering secondary school students with personalized AI tutoring and curriculum mastery.",
                    "inLanguage": "en"
                },
                {
                    "@@type": "WebSite",
                    "@@id": "{{ url('/') }}/#website",
                    "url": "{{ url('/') }}",
                    "name": "AILEARN",
                    "publisher": {
                        "@@id": "{{ url('/') }}/#organization"
                    },
                    "potentialAction": {
                        "@@type": "SearchAction",
                        "target": "{{ url('/subjects') }}?search={search_term_string}",
                        "query-input": "required name=search_term_string"
                    }
                },
                {
                    "@@type": "WebApplication",
                    "@@id": "{{ url('/') }}/#webapp",
                    "name": "AILEARN Web App",
                    "url": "{{ url('/') }}",
                    "applicationCategory": "EducationalApplication",
                    "operatingSystem": "All modern browsers (Chrome, Safari, Edge, Firefox), Android, iOS, Windows, macOS",
                    "offers": {
                        "@@type": "Offer",
                        "price": "0",
                        "priceCurrency": "USD"
                    },
                    "description": "Progressive Web Application (PWA) enabling fully offline secondary education, quizzes, active recall flashcards, and offline AI tutoring.",
                    "browserRequirements": "Requires JavaScript. Service Worker support recommended for offline mode.",
                    "featureList": [
                        "100% Offline Study Library",
                        "Step-by-Step AI Problem Walkthroughs",
                        "Curriculum-Aligned Assessments",
                        "Active Recall Flashcard System",
                        "Real-Time Automatic Sync"
                    ]
                }
            ]
        }
        </script>

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
