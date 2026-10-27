<?php

use App\Http\Controllers\MaintenanceController;
use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureIdempotentRequest;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function () {
            // PWA asset routes — registered with NO middleware at all so
            // Service-Worker-Allowed and other custom headers are never stripped.
            Route::middleware([])
                ->group(base_path('routes/pwa.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Every write needs a same-origin browser (Sec-Fetch-Site) or a CSRF token, /api/v1 included:
        // those routes use the browser session, so excluding them let other sites post as the user.
        // Routes in routes/api.php are not in the web group and never had this check.
        // The maintenance actions are exempt: they don't use the session and require their own
        // 32+ character token (EnsureMaintenanceToken), so `curl` with the header keeps working.
        $middleware->preventRequestForgery(except: array_keys(MaintenanceController::ACTIONS));
        $middleware->web(append: [
            EnsureAccountIsActive::class,
            HandleInertiaRequests::class,
            EnsureIdempotentRequest::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
