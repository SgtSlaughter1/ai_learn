<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class LoginController extends Controller
{
    public function show(): Response
    {
        return Inertia::render('auth/Login');
    }

    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            $request->session()->regenerate();
            $user = Auth::user();
            $role = $user->role instanceof \BackedEnum ? $user->role->value : ($user->role ?? 'learner');

            $redirectPath = $user->isAdmin() ? '/admin/dashboard' : ($user->isTeacher() ? '/teacher/dashboard' : '/dashboard');

            if ($request->wantsJson()) {
                return response()->json([
                    'status' => 'success',
                    'token' => session()->getId(),
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'role' => $role,
                    ],
                    'redirect' => $redirectPath,
                ]);
            }

            return redirect($redirectPath);
        }

        if ($request->wantsJson()) {
            return response()->json([
                'message' => trans('auth.failed'),
            ], 401);
        }

        throw ValidationException::withMessages([
            'email' => trans('auth.failed'),
        ]);
    }

    public function login(Request $request): JsonResponse|RedirectResponse
    {
        return $this->store($request);
    }

    public function getUser(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value ?? $user->role ?? 'learner',
            ],
        ]);
    }

    public function destroy(Request $request): RedirectResponse|JsonResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->wantsJson()) {
            return response()->json(['status' => 'logged_out']);
        }

        return redirect('/login');
    }

    public function logout(Request $request): JsonResponse|RedirectResponse
    {
        return $this->destroy($request);
    }

    /**
     * Refresh the active session token and return the newly generated session ID.
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $request->session()->regenerate();
        $role = $user->role?->value ?? $user->role;

        return response()->json([
            'status' => 'success',
            'token' => session()->getId(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $role ?? 'learner',
            ],
        ]);
    }
}
