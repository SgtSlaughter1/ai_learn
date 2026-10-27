<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveClassRequest;
use App\Http\Requests\Admin\UpdateClassRequest;
use App\Models\ClassModel;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ClassController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $gradeOrder = ClassModel::GRADE_ORDER;

        $classesQuery = ClassModel::forUser($user)
            ->with(['school:id,name', 'program:id,name,code,slug'])
            ->withCount(['learnerUsers as learner_count']);

        if ($request->filled('school_id')) {
            $classesQuery->where('school_id', $request->school_id);
        }

        $classes = $classesQuery
            ->when($request->filled('grade_level'), fn ($q) => $q->where('grade_level', $request->grade_level))
            ->when($request->filled('program_id'), fn ($q) => $q->where('program_id', $request->program_id))
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->values()
            ->all();

        return response()->json([
            'classes' => $classes,
            'data' => $classes,
            'grade_options' => $user->gradeOptions(),
            'allowed_grade_levels' => $user->allowedGradeLevels(),
        ]);
    }

    public function store(SaveClassRequest $request): JsonResponse
    {

        $validated = $request->validated();

        $assignedSchoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? null);
        $targetSchool = School::find($assignedSchoolId);
        if (! $targetSchool) {
            abort(404, 'Designated school not found.');
        }

        if (! $targetSchool->supportsGradeLevel($validated['grade_level'])) {
            throw ValidationException::withMessages(['grade_level' => "Grade level '{$validated['grade_level']}' is not permitted for school '{$targetSchool->name}' under category '{$targetSchool->category_type_label}'."]);
        }

        $slug = Str::slug($validated['name']).'-'.Str::random(5);
        $arm = $validated['arm'] ?? $validated['section'] ?? null;

        $class = ClassModel::create([
            'school_id' => $assignedSchoolId,
            'program_id' => $validated['program_id'] ?? null,
            'name' => $validated['name'],
            'slug' => $slug,
            'grade_level' => $validated['grade_level'],
            'arm' => $arm,
            'section' => $validated['section'] ?? $arm,
            'description' => $validated['description'] ?? null,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Class created successfully',
            'class' => $class->load(['school:id,name', 'program:id,name,code,slug'])->loadCount(['learnerUsers as learner_count']),
        ], 201);
    }

    public function update(UpdateClassRequest $request, int $id): JsonResponse
    {
        $class = ClassModel::findOrFail($id);
        Gate::authorize('update', $class);

        $validated = $request->validated();
        // Only platform admins move a class to another school.
        $validated['school_id'] = $request->user()->schoolForNewRecord($validated['school_id'] ?? $class->school_id);

        $effectiveSchoolId = $validated['school_id'] ?? $class->school_id;
        $targetSchool = School::find($effectiveSchoolId);
        if ($targetSchool && ! $targetSchool->supportsGradeLevel($validated['grade_level'])) {
            throw ValidationException::withMessages(['grade_level' => "Grade level '{$validated['grade_level']}' is not permitted for school '{$targetSchool->name}' under category '{$targetSchool->category_type_label}'."]);
        }

        if (isset($validated['arm']) && ! isset($validated['section'])) {
            $validated['section'] = $validated['arm'];
        } elseif (isset($validated['section']) && ! isset($validated['arm'])) {
            $validated['arm'] = $validated['section'];
        }

        $class->update($validated);

        return response()->json([
            'message' => 'Class updated successfully',
            'class' => $class->fresh(['school:id,name', 'program:id,name,code,slug'])->loadCount(['learnerUsers as learner_count']),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {

        $class = ClassModel::findOrFail($id);
        Gate::authorize('delete', $class);
        $class->delete();

        return response()->json(['message' => 'Class deleted successfully']);
    }
}
