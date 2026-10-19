<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Activate or deactivate accounts without deleting anything. A deactivated user, or any
 * user of a deactivated school, cannot sign in (see User::signInBlockedReason and the
 * EnsureAccountIsActive middleware) until reactivated.
 */
class AccountStatusController extends Controller
{
    public function updateUser(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $user = User::findOrFail($id);
        Gate::authorize('update', $user);

        if ($user->is($request->user()) && ! $validated['is_active']) {
            throw ValidationException::withMessages(['is_active' => 'You cannot deactivate your own account.']);
        }

        $user->forceFill(['is_active' => $validated['is_active']])->save();

        return response()->json([
            'message' => $validated['is_active'] ? 'Account activated' : 'Account deactivated',
            // Not 'user'/'school': clients treat those keys as the full saved record.
            'status' => ['id' => $user->id, 'is_active' => $user->is_active],
        ]);
    }

    public function updateSchool(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $school = School::findOrFail($id);
        Gate::authorize('update', $school);

        $school->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'message' => $validated['is_active']
                ? 'School activated: its users can sign in again'
                : 'School deactivated: its admins, teachers and learners can no longer sign in',
            'status' => ['id' => $school->id, 'is_active' => $school->is_active],
        ]);
    }
}
