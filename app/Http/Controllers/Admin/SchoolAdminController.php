<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveSchoolAdminRequest;
use App\Http\Requests\Admin\UpdateSchoolAdminRequest;
use App\Models\School;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;

class SchoolAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {

        $admins = User::whereIn('role', ['platform_admin', 'school_admin'])
            ->with(['administeredSchool:id,name,city,state,admin_user_id'])
            ->orderBy('name')
            ->get()
            ->map(function ($u) {
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'role' => $u->role?->value ?? $u->role,
                    'created_at' => $u->created_at?->toIso8601String(),
                    'administered_school' => $u->administeredSchool,
                    'school_id' => $u->administeredSchool?->id,
                ];
            })
            ->values()
            ->all();

        return response()->json(['school_admins' => $admins, 'data' => $admins]);
    }

    public function store(SaveSchoolAdminRequest $request): JsonResponse
    {

        $validated = $request->validated();

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::SCHOOL_ADMIN,
            ]);

            if (! empty($validated['school_id'])) {
                School::where('id', $validated['school_id'])->update(['admin_user_id' => $user->id]);
            }

            return $user;
        });

        $user->load('administeredSchool:id,name,city,state,admin_user_id');

        return response()->json([
            'message' => 'School Admin created and assigned successfully',
            'school_admin' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value ?? $user->role,
                'created_at' => $user->created_at?->toIso8601String(),
                'administered_school' => $user->administeredSchool,
                'school_id' => $user->administeredSchool?->id,
            ],
        ], 201);
    }

    public function update(UpdateSchoolAdminRequest $request, string $id): JsonResponse
    {

        $user = User::where('id', $id)->where('role', 'school_admin')->firstOrFail();
        Gate::authorize('update', $user);

        $validated = $request->validated();

        DB::transaction(function () use ($user, $validated) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (! empty($validated['password'])) {
                $userData['password'] = Hash::make($validated['password']);
            }
            $user->update($userData);

            // Re-assign school if requested
            if (array_key_exists('school_id', $validated)) {
                // Clear any previous school pointing to this admin
                School::where('admin_user_id', $user->id)->update(['admin_user_id' => null]);

                if (! empty($validated['school_id'])) {
                    School::where('id', $validated['school_id'])->update(['admin_user_id' => $user->id]);
                }
            }
        });

        $user->load('administeredSchool:id,name,city,state,admin_user_id');

        return response()->json([
            'message' => 'School Admin updated successfully',
            'school_admin' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role?->value ?? $user->role,
                'created_at' => $user->created_at?->toIso8601String(),
                'administered_school' => $user->administeredSchool,
                'school_id' => $user->administeredSchool?->id,
            ],
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {

        $user = User::where('id', $id)->where('role', 'school_admin')->firstOrFail();
        Gate::authorize('delete', $user);

        // Unlink school admin from schools
        School::where('admin_user_id', $user->id)->update(['admin_user_id' => null]);
        $archived = $user->removeAccount();

        return response()->json(['message' => 'School Admin removed successfully', 'archived' => $archived]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Teachers Management (School Admin & Super Admin)
    // ──────────────────────────────────────────────────────────────────────────
}
