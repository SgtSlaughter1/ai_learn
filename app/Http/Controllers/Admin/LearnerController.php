<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveLearnerRequest;
use App\Http\Requests\Admin\UpdateLearnerRequest;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\School;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;

class LearnerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'learner')
            ->managedBy($request->user())
            ->with([
                'learnerProfile.school:id,name',
                'gamification:id,user_id,total_xp,level,tier',
                'classes:id,name,grade_level,arm,section,program_id',
                'classes.program:id,name,code',
            ]);

        if ($request->filled('school_id')) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $request->school_id));
        }

        if ($request->filled('grade_level')) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('grade_level', $request->grade_level));
        }

        if ($request->filled('class_id')) {
            $query->whereHas('classes', fn ($q) => $q->where('classes.id', $request->class_id));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('learnerProfile', fn ($lp) => $lp->where('student_id', 'like', "%{$search}%"));
            });
        }

        $learners = $query->orderBy('name')
            ->paginate($request->get('per_page', 50));

        return response()->json([
            'learners' => $learners->items(),
            'data' => $learners->items(),
            'pagination' => [
                'total' => $learners->total(),
                'per_page' => $learners->perPage(),
                'current_page' => $learners->currentPage(),
                'last_page' => $learners->lastPage(),
            ],
            'meta' => [
                'current_page' => $learners->currentPage(),
                'last_page' => $learners->lastPage(),
                'per_page' => $learners->perPage(),
                'total' => $learners->total(),
            ],
        ]);
    }

    public function store(SaveLearnerRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $validated['school_id'] = $request->user()->schoolForNewRecord($validated['school_id'] ?? null);

        $targetSchool = ! empty($validated['school_id']) ? School::find($validated['school_id']) : null;

        if (! empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if (! $targetClass) {
                return response()->json(['error' => 'Selected class does not exist.'], 422);
            }
            if ($targetSchool && $targetClass->school_id !== $targetSchool->id) {
                return response()->json(['error' => 'The selected class does not belong to the selected school.'], 422);
            }
            if ($targetSchool && ! $targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                return response()->json(['error' => "Class grade level ({$targetClass->grade_level}) is not supported by the school's category ({$targetSchool->category})."], 422);
            }
            if (empty($validated['grade_level'])) {
                $validated['grade_level'] = $targetClass->grade_level;
            }
        }

        if (! empty($validated['grade_level']) && $targetSchool && ! $targetSchool->supportsGradeLevel($validated['grade_level'])) {
            return response()->json(['error' => "Grade level {$validated['grade_level']} is not supported by the school's category ({$targetSchool->category})."], 422);
        }

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::LEARNER,
            ]);

            LearnerProfile::create([
                'user_id' => $user->id,
                'school_id' => $validated['school_id'] ?? null,
                'grade_level' => $validated['grade_level'] ?? null,
                'student_id' => $validated['student_id'] ?? null,
                'is_active' => true,
            ]);

            UserGamification::create([
                'user_id' => $user->id,
                'total_xp' => 0,
                'current_streak' => 0,
                'level' => 1,
                'tier' => 'Newcomer',
            ]);

            if (! empty($validated['class_id'])) {
                ClassMembership::create([
                    'class_id' => $validated['class_id'],
                    'user_id' => $user->id,
                    'role' => 'learner',
                    'is_active' => true,
                ]);
            }

            return $user;
        });

        $user->load(['learnerProfile.school:id,name', 'gamification', 'classes']);

        return response()->json([
            'message' => 'Learner added successfully',
            'learner' => $user,
        ], 201);
    }

    public function update(UpdateLearnerRequest $request, string $id): JsonResponse
    {
        $user = User::where('id', $id)->where('role', 'learner')->firstOrFail();
        Gate::authorize('update', $user);

        $validated = $request->validated();
        $validated['school_id'] = $request->user()->schoolForNewRecord($validated['school_id'] ?? $user->learnerProfile?->school_id);

        $effectiveSchoolId = $validated['school_id'] ?? $user->learnerProfile?->school_id;
        $targetSchool = $effectiveSchoolId ? School::find($effectiveSchoolId) : null;

        if (! empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if (! $targetClass) {
                return response()->json(['error' => 'Selected class does not exist.'], 422);
            }
            if ($targetSchool && $targetClass->school_id !== $targetSchool->id) {
                return response()->json(['error' => 'The selected class does not belong to the selected school.'], 422);
            }
            if ($targetSchool && ! $targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                return response()->json(['error' => "Class grade level ({$targetClass->grade_level}) is not supported by the school's category ({$targetSchool->category})."], 422);
            }
        }

        if (! empty($validated['grade_level']) && $targetSchool && ! $targetSchool->supportsGradeLevel($validated['grade_level'])) {
            return response()->json(['error' => "Grade level {$validated['grade_level']} is not supported by the school's category ({$targetSchool->category})."], 422);
        }

        DB::transaction(function () use ($user, $validated) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (! empty($validated['password'])) {
                $userData['password'] = Hash::make($validated['password']);
            }
            $user->update($userData);

            $profile = LearnerProfile::firstOrNew(['user_id' => $user->id]);
            $profile->fill([
                'school_id' => $validated['school_id'] ?? $profile->school_id,
                'grade_level' => $validated['grade_level'] ?? $profile->grade_level,
                'student_id' => $validated['student_id'] ?? $profile->student_id,
                'is_active' => $validated['is_active'] ?? $profile->is_active ?? true,
            ]);
            $profile->save();

            if (isset($validated['class_id'])) {
                if ($validated['class_id']) {
                    ClassMembership::updateOrCreate(
                        ['user_id' => $user->id, 'role' => 'learner'],
                        ['class_id' => $validated['class_id'], 'is_active' => true]
                    );
                } else {
                    ClassMembership::where('user_id', $user->id)->where('role', 'learner')->delete();
                }
            }
        });

        $user->load(['learnerProfile.school:id,name', 'gamification', 'classes']);

        return response()->json([
            'message' => 'Learner updated successfully',
            'learner' => $user,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $user = User::where('id', $id)->where('role', 'learner')->firstOrFail();
        Gate::authorize('delete', $user);

        $archived = DB::transaction(function () use ($user) {
            ClassMembership::where('user_id', $user->id)->delete();

            return $user->removeAccount();
        });

        return response()->json(['message' => 'Learner deleted successfully', 'archived' => $archived]);
    }
}
