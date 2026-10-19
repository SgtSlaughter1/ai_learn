<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The signed-in user's own account: their profile page and its Danger Zone. Both actions
 * need the current password and sign the user out. A deactivated account can only be
 * reactivated by an admin; a deleted account is archived (see User::deleteAccount).
 */
class AccountController extends Controller
{
    public function show(Request $request): Response
    {
        $user = $request->user();
        $schoolId = $user->isPlatformAdmin() ? null : $user->managedSchoolId();

        return Inertia::render('Profile', [
            'profile' => [
                'school_name' => $schoolId ? School::whereKey($schoolId)->value('name') : null,
                'member_since' => $user->created_at?->toDateString(),
            ],
        ]);
    }

    public function deactivate(Request $request): JsonResponse
    {
        $user = $this->confirmedUser($request);
        $user->forceFill(['is_active' => false])->save();
        $this->signOut($request);

        return response()->json(['message' => 'Your account has been deactivated. An administrator can reactivate it.']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $user = $this->confirmedUser($request);
        $user->deleteAccount();
        $this->signOut($request);

        return response()->json(['message' => 'Your account has been deleted.']);
    }

    /** The signed-in user, after checking their password and that the platform keeps an admin. */
    private function confirmedUser(Request $request): User
    {
        $request->validate(['password' => ['required', 'current_password']]);
        $user = $request->user();

        if ($user->isPlatformAdmin()) {
            $otherActiveAdmins = User::where('role', UserRole::PLATFORM_ADMIN)
                ->whereKeyNot($user->id)
                ->where('is_active', true)
                ->exists();
            if (! $otherActiveAdmins) {
                throw ValidationException::withMessages([
                    'password' => 'You are the only active platform admin. Add another platform admin first.',
                ]);
            }
        }

        return $user;
    }

    private function signOut(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
