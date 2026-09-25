<?php

/**
 * PWA Static Asset Routes — NO middleware whatsoever.
 *
 * These routes serve the service worker, workbox chunk, and web manifest
 * with exact headers we set. The web middleware stack (session, cookies,
 * Inertia, cache-control override) must NOT touch these responses — that's
 * why they live in their own file registered outside the web group.
 *
 * Critical headers:
 *   - Service-Worker-Allowed: /  →  lets /build/sw.js control the full / scope
 *   - Content-Type: application/javascript  →  required for SW registration
 *   - Content-Type: application/manifest+json  →  required for PWA manifest parsing
 *   - Cache-Control: no-cache  →  ensures browser always checks for SW updates
 */

use Illuminate\Support\Facades\Route;

// ── Service Worker ────────────────────────────────────────────────────────────

Route::get('/build/sw.js', function () {
    $path = public_path('build/sw.js');
    if (!file_exists($path)) {
        return response('/* sw.js not found */', 404)
            ->header('Content-Type', 'application/javascript');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'application/javascript')
        ->header('Service-Worker-Allowed', '/')
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache');
});

Route::get('/sw.js', function () {
    // Alias — points to the same built file
    $path = public_path('build/sw.js');
    if (!file_exists($path)) {
        return response('/* sw.js not found */', 404)
            ->header('Content-Type', 'application/javascript');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'application/javascript')
        ->header('Service-Worker-Allowed', '/')
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate')
        ->header('Pragma', 'no-cache');
});

// ── Workbox Runtime Chunk ─────────────────────────────────────────────────────

Route::get('/build/workbox-{hash}.js', function (string $hash) {
    $path = public_path("build/workbox-{$hash}.js");
    if (!file_exists($path)) {
        return response("/* workbox-{$hash}.js not found */", 404)
            ->header('Content-Type', 'application/javascript');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'application/javascript')
        ->header('Cache-Control', 'public, max-age=31536000, immutable');
})->where('hash', '[a-zA-Z0-9]+');

Route::get('/workbox-{hash}.js', function (string $hash) {
    $path = public_path("build/workbox-{$hash}.js");
    if (!file_exists($path)) {
        $path = public_path("workbox-{$hash}.js");
    }
    if (!file_exists($path)) {
        return response("/* workbox-{$hash}.js not found */", 404)
            ->header('Content-Type', 'application/javascript');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'application/javascript')
        ->header('Cache-Control', 'public, max-age=31536000, immutable');
})->where('hash', '[a-zA-Z0-9]+');

// ── RegisterSW (no-op if not generated) ──────────────────────────────────────

Route::get('/build/registerSW.js', function () {
    $path = public_path('build/registerSW.js');
    $body = file_exists($path) ? file_get_contents($path) : '/* SW registered manually in app.blade.php */';
    return response($body, 200)->header('Content-Type', 'application/javascript');
});

Route::get('/registerSW.js', function () {
    $path = public_path('build/registerSW.js');
    $body = file_exists($path) ? file_get_contents($path) : '/* SW registered manually in app.blade.php */';
    return response($body, 200)->header('Content-Type', 'application/javascript');
});

// ── Web App Manifest ──────────────────────────────────────────────────────────

$serveManifest = function () {
    $candidates = [
        public_path('build/manifest.webmanifest'),
        public_path('manifest.webmanifest'),
        base_path('public/build/manifest.webmanifest'),
        base_path('public/manifest.webmanifest'),
        base_path('manifest.webmanifest'),
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/public/build/manifest.webmanifest',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/build/manifest.webmanifest',
        ($_SERVER['DOCUMENT_ROOT'] ?? '') . '/manifest.webmanifest',
    ];

    foreach ($candidates as $candidate) {
        if (!empty($candidate) && file_exists($candidate)) {
            return response(file_get_contents($candidate), 200)
                ->header('Content-Type', 'application/manifest+json')
                ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }

    // Fallback: Return a complete, valid PWA manifest instead of an empty `{}`
    $fallbackManifest = [
        'name' => 'AceDrill',
        'short_name' => 'AceDrill',
        'start_url' => '/',
        'display' => 'standalone',
        'background_color' => '#F7F4EC',
        'lang' => 'en',
        'scope' => '/',
        'id' => '/',
        'description' => 'An offline-first adaptive AI learning platform.',
        'theme_color' => '#183B2B',
        'icons' => [
            ['src' => '/images/icon-144x144.png', 'sizes' => '144x144', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/images/icon-192x192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/images/icon-512x512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any'],
            ['src' => '/images/icon-192x192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'maskable'],
            ['src' => '/images/icon-512x512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'maskable'],
        ],
        'screenshots' => [
            ['src' => '/images/screenshot-desktop.png', 'sizes' => '1280x720', 'type' => 'image/png', 'form_factor' => 'wide', 'label' => 'Dashboard - Desktop View'],
            ['src' => '/images/screenshot-mobile.png', 'sizes' => '750x1334', 'type' => 'image/png', 'label' => 'Dashboard - Mobile View'],
        ],
    ];

    return response()->json($fallbackManifest, 200, [
        'Content-Type' => 'application/manifest+json',
        'Cache-Control' => 'no-cache, no-store, must-revalidate',
    ], JSON_UNESCAPED_SLASHES);
};

Route::get('/manifest.webmanifest', $serveManifest);
Route::get('/build/manifest.webmanifest', $serveManifest);
Route::get('/manifest.json', $serveManifest);

// ── Offline Fallback Page ─────────────────────────────────────────────────────

Route::get('/offline.html', function () {
    $path = public_path('offline.html');
    if (!file_exists($path)) {
        return response('<h1>You are offline</h1>', 200)->header('Content-Type', 'text/html');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'text/html; charset=UTF-8')
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
});
