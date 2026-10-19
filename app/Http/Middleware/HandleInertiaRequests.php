<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     */
    public function version(Request $request): ?string
    {
        if (file_exists(public_path('hot')) || app()->environment('local')) {
            return null;
        }

        return parent::version($request);
    }

    /**
     * Defines the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            // Lazy: this middleware runs on every web request, including JSON API calls that
            // never render a page; a closure is only evaluated when Inertia renders one.
            'auth' => fn () => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'role' => $request->user()->role instanceof \BackedEnum ? $request->user()->role->value : ($request->user()->role ?? 'learner'),
                    'has_school_access' => $request->user()->hasSchoolAccess(),
                ] : null,
                // What the UI may offer, from the same gates that guard the routes.
                'can' => $request->user() ? [
                    'accessAdmin' => $request->user()->can('access-admin'),
                    'accessTeaching' => $request->user()->can('access-teaching'),
                    'managePlatform' => $request->user()->can('manage-platform'),
                    'manageCurriculum' => $request->user()->can('create', \App\Models\Subject::class),
                ] : null,
            ],
        ]);
    }
}
