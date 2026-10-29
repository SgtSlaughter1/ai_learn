<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Consent;
use App\Models\LearnerProfile;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisterController extends Controller
{
    /**
     * Show the learner registration page.
     */
    public function show(): Response
    {
        return Inertia::render('auth/Register');
    }

    /**
     * Handle the incoming registration request for a new independent learner.
     */
    public function store(Request $request): RedirectResponse|JsonResponse
    {
        // Normalise rather than reject "Ada@School.ng" (the old 'lowercase' rule refused it).
        if (is_string($request->input('email'))) {
            $request->merge(['email' => mb_strtolower(trim($request->input('email')))]);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
        ]);

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::LEARNER,
            ]);

            // Independent learner with no school attached
            LearnerProfile::create([
                'user_id' => $user->id,
                'school_id' => null,
                'is_active' => true,
            ]);

            // Initialize gamification profile
            UserGamification::firstOrCreate(
                ['user_id' => $user->id],
                [
                    'total_xp' => 0,
                    'level' => 1,
                    'tier' => 'Newcomer',
                    'current_streak' => 0,
                    'longest_streak' => 0,
                    'last_active_date' => now()->toDateString(),
                ]
            );

            // The sign-up form says creating an account means agreeing to the Terms and Privacy Policy.
            Consent::record($user, Consent::TERMS, true, Consent::SOURCE_SELF);

            return $user;
        });

        Auth::login($user);
        $request->session()->regenerate();

        if ($request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => 'learner',
                    'has_school_access' => false,
                ],
                'redirect' => '/dashboard',
            ], 201);
        }

        return redirect('/dashboard');
    }
}
