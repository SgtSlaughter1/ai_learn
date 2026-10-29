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
        $school = $schoolId ? School::find($schoolId) : null;

        return Inertia::render('Profile', [
            'profile' => [
                'school_name' => $school?->name,
                'member_since' => $user->created_at?->toDateString(),
                'school' => $school ? [
                    'name' => $school->name,
                    'levels' => $school->category_type_label,
                    'address' => collect([$school->address, $school->city, $school->state])->filter()->unique()->implode(', ') ?: null,
                    'phone' => $school->phone,
                    'email' => $school->email,
                ] : null,
                'learner' => $user->isLearner() ? [
                    'student_id' => $user->learnerProfile?->student_id,
                    'grade_level' => $user->learnerProfile?->grade_level,
                ] : null,
                'teacher' => $user->isTeacher() ? [
                    'employee_id' => $user->teacherProfile?->employee_id,
                    'department' => $user->teacherProfile?->department,
                ] : null,
                'classes' => match (true) {
                    $user->isLearner(), $user->isTeacher() => $this->classesOf($user),
                    $user->isSchoolAdmin() && $school !== null => $this->schoolClasses($school),
                    default => [],
                },
                'school_counts' => $school ? [
                    'teachers' => $school->teachers()->count(),
                    'learners' => $school->learners()->count(),
                    'classes' => $school->classes()->where('is_active', true)->count(),
                ] : null,
                'schools' => $user->isPlatformAdmin() ? $this->allSchools() : [],
                // Learners' answer comes from their parent's form via the school; adults choose here.
                'ai_training' => ['allowed' => $user->allowsAiTraining(), 'can_change' => $user->givesOwnConsent()],
            ],
        ]);
    }

    /** Every active class in a school admin's school, with teachers and learner numbers. */
    private function schoolClasses(School $school): array
    {
        return $school->classes()
            ->where('is_active', true)
            ->with('teacherUsers:users.id,users.name')
            ->withCount('learnerUsers')
            ->orderBy('name')
            ->get()
            ->map(fn ($class) => [
                'id' => $class->id,
                'name' => $class->name,
                'grade_level' => $class->grade_level,
                'arm' => $class->school_class_arm,
                'teachers' => $class->teacherUsers->pluck('name')->values()->all(),
                'learners' => $class->learner_users_count,
            ])
            ->all();
    }

    /** Every school on the platform, for a platform admin's profile. */
    private function allSchools(): array
    {
        return School::with('admin:id,name')
            ->withCount(['learners', 'teachers', 'classes'])
            ->orderBy('name')
            ->get()
            ->map(fn (School $school) => [
                'id' => $school->id,
                'name' => $school->name,
                'levels' => $school->category_type_label,
                'city' => $school->city ?: $school->state,
                'admin' => $school->admin?->name,
                'is_active' => $school->is_active,
                'learners' => $school->learners_count,
                'teachers' => $school->teachers_count,
                'classes' => $school->classes_count,
            ])
            ->all();
    }

    /** The classes a learner sits in or a teacher teaches, each with its teachers' names. */
    private function classesOf(User $user): array
    {
        return $user->classes()
            ->where('classes.is_active', true)
            ->with('teacherUsers:users.id,users.name')
            ->orderBy('classes.name')
            ->get()
            ->map(fn ($class) => [
                'id' => $class->id,
                'name' => $class->name,
                'grade_level' => $class->grade_level,
                'arm' => $class->school_class_arm,
                'teachers' => $class->teacherUsers->pluck('name')->values()->all(),
            ])
            ->all();
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
