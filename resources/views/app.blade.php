<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#4f46e5">

        <title inertia>{{ config('app.name', 'Offline AI Learning Platform') }}</title>

        <!-- PWA Manifest -->
        <link rel="manifest" href="/build/manifest.webmanifest">
        <link rel="apple-touch-icon" href="/images/icon-192x192.png">

        <!-- Scripts -->
        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
        <script src="/build/registerSW.js"></script>
    </body>
</html>
