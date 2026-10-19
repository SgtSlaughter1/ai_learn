<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Signs out a user whose account (or school) was deactivated while they were signed in,
 * including background sync requests. Sign-in itself is always checked (LoginController);
 * here the check is repeated at most once a minute per session, so it adds no queries to
 * most requests while still taking effect within a minute.
 */
class EnsureAccountIsActive
{
    private const RECHECK_SECONDS = 60;

    public const SESSION_KEY = 'account_active_checked_at';

    /** Record that the account was just confirmed active (e.g. right after signing in). */
    public static function markChecked(Request $request): void
    {
        $request->session()->put(self::SESSION_KEY, now()->getTimestamp());
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user || ! $request->hasSession()) {
            return $next($request);
        }

        $checkedAt = (int) $request->session()->get(self::SESSION_KEY, 0);
        if (now()->getTimestamp() - $checkedAt < self::RECHECK_SECONDS) {
            return $next($request);
        }

        $reason = $user->signInBlockedReason();
        if ($reason === null) {
            self::markChecked($request);

            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson()) {
            return response()->json(['message' => $reason, 'code' => 'account_inactive'], 401);
        }

        return redirect('/login')->withErrors(['email' => $reason]);
    }
}
