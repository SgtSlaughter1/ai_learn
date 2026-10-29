<?php

namespace App\Http\Middleware;

use App\Models\Consent;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sends a signed-in person to the agree screen until they have agreed to the current Terms and
 * Privacy Policy (config legal.require_acceptance). Only page visits are stopped: background API
 * calls such as offline sync carry on, so no work is lost while someone hasn't agreed yet.
 * The answer is remembered in the session, so this adds no query to later requests.
 */
class EnsureTermsAccepted
{
    public const SESSION_KEY = 'legal_accepted_version';

    /** Pages that must stay reachable before agreeing. */
    private const ALWAYS_OPEN = ['consent', 'terms', 'privacy', 'logout'];

    public static function remember(Request $request): void
    {
        if ($request->hasSession()) {
            $request->session()->put(self::SESSION_KEY, Consent::currentVersion(Consent::TERMS));
        }
    }

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! config('legal.require_acceptance') || ! $user || ! $request->isMethod('GET') || $request->expectsJson()
            || $request->is('api/*') || $request->is(...self::ALWAYS_OPEN)) {
            return $next($request);
        }

        if ($request->session()->get(self::SESSION_KEY) === Consent::currentVersion(Consent::TERMS)) {
            return $next($request);
        }
        if ($user->hasAcceptedCurrentTerms()) {
            self::remember($request);

            return $next($request);
        }

        return redirect()->guest('/consent');
    }
}
