<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveSubjectRequest;
use App\Http\Requests\Admin\UpdateSubjectRequest;
use App\Models\ClassModel;
use App\Models\School;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class SubjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Subject::forUser($user)
            ->withCount(['topics'])
            ->with([
                'school:id,name',
                'schoolClass:id,name,grade_level,section',
                'topics' => function ($q) {
                    $q->withCount('questions')->orderBy('sort_order');
                },
            ]);

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        $subjects = $query->orderBy('sort_order')->orderBy('name')->get();
        $this->withAbilities($subjects);
        $this->withAbilities($subjects->pluck('topics')->flatten());
        $subjects = $subjects->values()->all();

        return response()->json(['subjects' => $subjects, 'data' => $subjects]);
    }

    public function store(SaveSubjectRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (Subject::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $targetClass = $this->classForSubject($validated['class_id'] ?? null);
        $schoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? $targetClass?->school_id);
        $this->ensureClassInSchool($targetClass, $schoolId);

        $subject = Subject::create([
            'school_id' => $schoolId,
            'class_id' => $targetClass?->id,
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject->load(['school:id,name', 'schoolClass:id,name,grade_level'])->loadCount('topics'),
        ], 201);
    }

    public function update(UpdateSubjectRequest $request, int $id): JsonResponse
    {
        $subject = Subject::findOrFail($id);
        Gate::authorize('update', $subject);

        $validated = $request->validated();
        if (! empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        // Only platform admins may move a subject between schools (or make it global).
        $validated['school_id'] = $request->user()->schoolForNewRecord(
            array_key_exists('school_id', $validated) ? $validated['school_id'] : $subject->school_id
        );

        if (! empty($validated['class_id'])) {
            $targetClass = $this->classForSubject($validated['class_id']);
            // A global subject attached to a school's class becomes that school's subject.
            $validated['school_id'] ??= $targetClass->school_id;
            $this->ensureClassInSchool($targetClass, $validated['school_id']);
        }

        $subject->update($validated);

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject->fresh(['school:id,name', 'schoolClass:id,name,grade_level'])->loadCount('topics'),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $subject = Subject::findOrFail($id);
        Gate::authorize('delete', $subject);
        $subject->delete();

        return response()->json(['message' => 'Subject deleted successfully']);
    }

    /** The class a subject is attached to: it must exist, be manageable by the user, and fit its school's grades. */
    private function classForSubject(int|string|null $classId): ?ClassModel
    {
        if (empty($classId)) {
            return null;
        }
        $class = ClassModel::find($classId) ?? abort(422, 'Selected class does not exist.');
        Gate::authorize('update', $class);

        $school = School::find($class->school_id);
        if ($school && ! $school->supportsGradeLevel($class->grade_level)) {
            abort(422, "The selected class grade level ({$class->grade_level}) is not permitted under school category ({$school->category}).");
        }

        return $class;
    }

    private function ensureClassInSchool(?ClassModel $class, int|string|null $schoolId): void
    {
        if ($class && $schoolId !== null && (int) $class->school_id !== (int) $schoolId) {
            abort(422, 'The selected class does not belong to the designated school.');
        }
    }
}
