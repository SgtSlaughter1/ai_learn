<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset request view.
     */
    public function show(): Response
    {
        return Inertia::render('auth/ForgotPassword', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     */
    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = $request->input('email');
        $user = User::where('email', $email)->first();

        if ($user) {
            try {
                $token = Password::broker()->createToken($user);
                $user->sendPasswordResetNotification($token);
            } catch (\Exception $e) {
                // If mail sending encounters an error (e.g. SMTP not configured yet), log the link safely
                $resetUrl = url(route('password.reset', [
                    'token' => $token ?? 'preview-token',
                    'email' => $email,
                ], false));
                Log::info("[Password Reset Link for {$email}]: {$resetUrl}");
            }
        }

        // Always return success message to prevent user enumeration attacks
        $message = "If an account matches that email address, we've sent a link to reset your password.";

        if ($request->wantsJson()) {
            return response()->json([
                'status' => 'success',
                'message' => $message,
            ]);
        }

        return back()->with('status', $message);
    }
}
