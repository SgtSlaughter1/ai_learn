<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Guards the maintenance actions (MaintenanceController). They answer 404 unless MAINTENANCE_TOKEN
 * is set to at least 32 characters and the request carries it in the X-Maintenance-Token header
 * or the form's `token` field. Never in the URL: query strings end up in server logs, browser
 * history and link previews.
 */
class EnsureMaintenanceToken
{
    public const MIN_LENGTH = 32;

    public static function isConfigured(): bool
    {
        return strlen((string) config('app.maintenance_token')) >= self::MIN_LENGTH;
    }

    public function handle(Request $request, Closure $next): Response
    {
        $provided = (string) ($request->header('X-Maintenance-Token') ?? $request->post('token', ''));

        if (! self::isConfigured() || ! hash_equals((string) config('app.maintenance_token'), $provided)) {
            Log::warning('maintenance.denied', ['path' => $request->path(), 'ip' => $request->ip()]);
            abort(404);
        }

        Log::notice('maintenance.run', ['path' => $request->path(), 'ip' => $request->ip()]);

        return $next($request);
    }
}
