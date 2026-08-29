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

Route::get('/manifest.webmanifest', function () {
    $path = public_path('build/manifest.webmanifest');
    if (!file_exists($path)) {
        $path = public_path('manifest.webmanifest');
    }
    if (!file_exists($path)) {
        return response('{}', 404)->header('Content-Type', 'application/manifest+json');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'application/manifest+json')
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
});

Route::get('/build/manifest.webmanifest', function () {
    $path = public_path('build/manifest.webmanifest');
    if (!file_exists($path)) {
        return response('{}', 404)->header('Content-Type', 'application/manifest+json');
    }
    return response(file_get_contents($path), 200)
        ->header('Content-Type', 'application/manifest+json')
        ->header('Cache-Control', 'no-cache, no-store, must-revalidate');
});

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
