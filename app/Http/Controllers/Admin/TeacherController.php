<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveTeacherRequest;
use App\Http\Requests\Admin\UpdateTeacherRequest;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\School;
use App\Models\TeacherProfile;
use App\Models\User;
use App\Support\ListSize;
use App\Support\SearchTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;

class TeacherController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::where('role', 'teacher')
            ->managedBy($request->user())
            ->with([
                'teacherProfile.school:id,name',
                'classes' => function ($q) {
                    $q->wherePivot('role', 'teacher')
                        ->select(['classes.id', 'classes.name', 'classes.grade_level', 'classes.arm', 'classes.section']);
                },
            ]);

        if ($request->filled('school_id')) {
            $query->whereHas('teacherProfile', fn ($q) => $q->where('school_id', $request->school_id));
        }

        if ($request->filled('class_id')) {
            $query->whereHas('classMemberships', fn ($q) => $q->where('class_id', $request->class_id)->where('role', 'teacher'));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', SearchTerm::like($search))
                    ->orWhere('email', 'like', SearchTerm::like($search))
                    ->orWhereHas('teacherProfile', fn ($tp) => $tp->where('employee_id', 'like', SearchTerm::like($search))->orWhere('department', 'like', SearchTerm::like($search)));
            });
        }

        $perPage = ListSize::from($request->get('per_page'), 50, 100);
        $teachers = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'teachers' => $teachers->items(),
            'data' => $teachers->items(),
            'pagination' => [
                'total' => $teachers->total(),
                'per_page' => $teachers->perPage(),
                'current_page' => $teachers->currentPage(),
                'last_page' => $teachers->lastPage(),
            ],
            'meta' => [
                'current_page' => $teachers->currentPage(),
                'last_page' => $teachers->lastPage(),
                'per_page' => $teachers->perPage(),
                'total' => $teachers->total(),
            ],
        ]);
    }

    public function store(SaveTeacherRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $targetSchoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? null);
        $classes = $this->assignableClasses($validated, $targetSchoolId);

        $teacherUser = DB::transaction(function () use ($validated, $targetSchoolId, $classes) {
            $teacher = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::TEACHER,
            ]);

            TeacherProfile::create([
                'user_id' => $teacher->id,
                'school_id' => $targetSchoolId,
                'employee_id' => $validated['employee_id'] ?? null,
                'department' => $validated['department'] ?? null,
                'bio' => $validated['bio'] ?? null,
                'is_active' => true,
            ]);

            $this->syncTeacherClasses($teacher, $classes);

            return $teacher;
        });

        $teacherUser->load([
            'teacherProfile.school:id,name',
            'classes' => fn ($q) => $q->wherePivot('role', 'teacher')->select(['classes.id', 'classes.name', 'classes.grade_level', 'classes.arm', 'classes.section']),
        ]);

        return response()->json([
            'message' => 'Teacher created and assigned successfully',
            'teacher' => $teacherUser,
        ], 201);
    }

    public function update(UpdateTeacherRequest $request, string $id): JsonResponse
    {
        $teacherUser = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        Gate::authorize('update', $teacherUser);

        $validated = $request->validated();
        // Only platform admins move a teacher to another school.
        $targetSchoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? $teacherUser->managedSchoolId());
        $classes = array_key_exists('class_ids', $validated) || array_key_exists('class_id', $validated)
            ? $this->assignableClasses($validated, $targetSchoolId)
            : null;

        $previousSchoolId = $teacherUser->managedSchoolId();

        DB::transaction(function () use ($teacherUser, $validated, $targetSchoolId, $previousSchoolId, $classes) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (! empty($validated['password'])) {
                $userData['password'] = Hash::make($validated['password']);
            }
            $teacherUser->update($userData);

            $profileData = [];
            if (array_key_exists('department', $validated)) {
                $profileData['department'] = $validated['department'];
            }
            if (array_key_exists('employee_id', $validated)) {
                $profileData['employee_id'] = $validated['employee_id'];
            }
            if (array_key_exists('bio', $validated)) {
                $profileData['bio'] = $validated['bio'];
            }
            if (array_key_exists('is_active', $validated)) {
                $profileData['is_active'] = $validated['is_active'];
            }
            if ($targetSchoolId !== $previousSchoolId) {
                $profileData['school_id'] = $targetSchoolId;
            }

            if (! empty($profileData)) {
                $teacherUser->teacherProfile()->updateOrCreate(['user_id' => $teacherUser->id], $profileData);
            }

            // A teacher who moves school leaves the old school's classes; otherwise they keep
            // managing those rosters and the old school's admin can still edit their account.
            if ($targetSchoolId !== $previousSchoolId) {
                $teacherUser->classMemberships()
                    ->whereNotIn('class_id', ClassModel::where('school_id', $targetSchoolId)->select('id'))
                    ->delete();
            }

            if ($classes !== null) {
                $this->syncTeacherClasses($teacherUser, $classes, replace: true);
            }
        });

        $teacherUser->load([
            'teacherProfile.school:id,name',
            'classes' => fn ($q) => $q->wherePivot('role', 'teacher')->select(['classes.id', 'classes.name', 'classes.grade_level', 'classes.arm', 'classes.section']),
        ]);

        return response()->json([
            'message' => 'Teacher updated successfully',
            'teacher' => $teacherUser,
        ]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $teacherUser = User::where('id', $id)->where('role', 'teacher')->firstOrFail();
        Gate::authorize('delete', $teacherUser);

        $teacherUser->deleteAccount();

        return response()->json(['message' => 'Teacher deleted successfully', 'archived' => true]);
    }

    /**
     * The classes named in the request (class_ids, or a single class_id). Each must be one
     * the admin manages and in the teacher's school, so a teacher can't be attached to
     * another school's class.
     *
     * @return Collection<int, ClassModel>
     */
    private function assignableClasses(array $validated, ?int $teacherSchoolId)
    {
        $ids = $validated['class_ids'] ?? (! empty($validated['class_id']) ? [$validated['class_id']] : []);
        $classes = ClassModel::whereIn('id', $ids)->get();

        foreach ($classes as $class) {
            Gate::authorize('update', $class);
            if ($teacherSchoolId !== null && (int) $class->school_id !== $teacherSchoolId) {
                abort(422, "Class '{$class->name}' belongs to a different school than this teacher.");
            }
        }

        return $classes;
    }

    private function syncTeacherClasses(User $teacher, $classes, bool $replace = false): void
    {
        if ($replace) {
            ClassMembership::where('user_id', $teacher->id)
                ->where('role', 'teacher')
                ->whereNotIn('class_id', $classes->pluck('id'))
                ->delete();
        }
        foreach ($classes as $class) {
            ClassMembership::updateOrCreate(
                ['class_id' => $class->id, 'user_id' => $teacher->id],
                ['role' => 'teacher', 'is_active' => true]
            );
        }
    }
}
