<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#183B2B">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
        <meta name="apple-mobile-web-app-title" content="AceDrill">
        @php($seo = \App\Support\Seo::forRequest(request()))
        <title inertia>{{ $seo['title'] }}</title>
        <meta name="description" content="{{ $seo['description'] }}">
        <meta name="robots" content="{{ $seo['robots'] }}">

        {{-- Theme Initialization (Anti-FOUC) --}}
        <script>
            document.documentElement.classList.add('js');
            (function() {
                try {
                    var theme = localStorage.getItem('theme');
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (theme === 'dark' || (!theme && prefersDark)) {
                        document.documentElement.classList.add('dark');
                        document.documentElement.setAttribute('data-theme', 'dark');
                    } else {
                        document.documentElement.classList.remove('dark');
                        document.documentElement.setAttribute('data-theme', 'light');
                    }
                } catch (e) {}
            })();
        </script>

        {{-- Search & answer engines (App\Support\Seo) --}}
        <link rel="canonical" href="{{ $seo['canonical'] }}">
        <link rel="alternate" type="text/plain" title="LLM summary" href="{{ \App\Support\Seo::url('/llms.txt') }}">
        <meta property="og:type" content="website">
        <meta property="og:site_name" content="AceDrill">
        <meta property="og:url" content="{{ $seo['canonical'] }}">
        <meta property="og:title" content="{{ $seo['title'] }}">
        <meta property="og:description" content="{{ $seo['description'] }}">
        <meta property="og:image" content="{{ $seo['image'] }}">
        <meta property="og:image:width" content="1280">
        <meta property="og:image:height" content="720">
        <meta property="og:image:alt" content="AceDrill learner dashboard">
        <meta property="og:locale" content="en_NG">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="{{ $seo['title'] }}">
        <meta name="twitter:description" content="{{ $seo['description'] }}">
        <meta name="twitter:image" content="{{ $seo['image'] }}">
        <script type="application/ld+json">{!! json_encode($seo['jsonLd'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>
        {{-- The plain-HTML copy below is for crawlers without JavaScript; the app replaces it. --}}
        <style>.js #seo-content{display:none}</style>

        {{-- Favicons --}}
        <link rel="icon" type="image/svg+xml" href="/images/favicon.svg">
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png">
        <link rel="shortcut icon" href="/favicon.ico">

        {{-- PWA Manifest --}}
        <link rel="manifest" href="/manifest.webmanifest">
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">

        {{-- Scripts --}}
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
        @if (\App\Support\Seo::isPublic(request()))
            @include('seo.content')
        @endif
        {{-- Comments live in Blade comments so they are not sent to the browser.
             The SW is registered from /sw.js (root path) so it controls the full / scope
             without a Service-Worker-Allowed header (the PHP dev server strips it).
             A SW taking control doesn't need a reload: on a first visit it just starts
             controlling this page; for a new version, reloading on the spot would throw
             away the user's work, so the app switches to the new build at the next page
             visit with one normal full load (see app.tsx). --}}
        <script>
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
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

                    const hadController = !!navigator.serviceWorker.controller;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (hadController) {
                            window.__acedrillUpdateReady = true;
                        }
                    });
                });
            }
        </script>
    </body>
</html>
