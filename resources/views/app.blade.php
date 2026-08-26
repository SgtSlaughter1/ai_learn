<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#183B2B">

        <title inertia>{{ config('app.name', 'Offline AI Learning Platform') }}</title>

        <!-- Favicons -->
        <link rel="icon" type="image/png" sizes="32x32" href="/images/favicon-32x32.png">
        <link rel="icon" type="image/png" sizes="16x16" href="/images/favicon-16x16.png">
        <link rel="shortcut icon" href="/favicon.ico">

        <!-- PWA Manifest -->
        <link rel="manifest" href="/build/manifest.webmanifest">
        <link rel="apple-touch-icon" sizes="180x180" href="/images/apple-touch-icon.png">

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
