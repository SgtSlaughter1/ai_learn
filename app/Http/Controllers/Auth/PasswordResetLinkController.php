<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\PasswordResetLinkRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
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
    public function store(PasswordResetLinkRequest $request): RedirectResponse|JsonResponse
    {
        $email = $request->validated()['email'];

        // The broker also limits how often one account can be sent a link (auth.passwords.*.throttle).
        try {
            Password::sendResetLink(['email' => $email]);
        } catch (\Throwable $e) {
            // Never log the link itself: anyone who can read the log could reset the password.
            Log::error('password_reset.mail_failed', ['error' => class_basename($e).': '.$e->getMessage()]);
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
