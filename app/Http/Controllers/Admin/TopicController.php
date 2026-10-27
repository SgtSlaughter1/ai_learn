<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveTopicRequest;
use App\Http\Requests\Admin\UpdateTopicRequest;
use App\Models\ClassModel;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TopicController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Topic::forUser($user)
            ->with(['subject:id,name,slug,school_id,class_id', 'subject.schoolClass:id,name,grade_level'])
            ->withCount('questions');

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        if ($request->filled('class_id')) {
            $class = ClassModel::find($request->class_id);
            $query->where(function ($q) use ($request, $class) {
                $q->whereHas('subject', fn ($sub) => $sub->where('class_id', $request->class_id));
                if ($class && $class->grade_level) {
                    $q->orWhere('level', strtolower($class->grade_level))
                        ->orWhere('level', strtoupper($class->grade_level));
                }
            });
        }

        if ($request->filled('level')) {
            $query->where('level', $request->level);
        }

        $topics = $query->orderBy('sort_order')->get();
        $this->withAbilities($topics);
        $topics = $topics->values()->all();

        return response()->json(['topics' => $topics, 'data' => $topics]);
    }

    public function store(SaveTopicRequest $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validated();

        $subject = Subject::with('schoolClass')->findOrFail($validated['subject_id']);
        Gate::authorize('create', [Topic::class, $subject]);

        $inferredLevel = $validated['level'] ?? ($subject?->schoolClass?->grade_level ? strtoupper($subject->schoolClass->grade_level) : 'SS1');
        if (! $user->supportsGradeLevel($inferredLevel)) {
            throw ValidationException::withMessages(['grade_level' => "Grade level '{$inferredLevel}' is not permitted for your school/role."]);
        }

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (Topic::withTrashed()->where('subject_id', $validated['subject_id'])->where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $topic = Topic::create([
            'subject_id' => $validated['subject_id'],
            'name' => $validated['name'],
            'slug' => $slug,
            'level' => $inferredLevel,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json([
            'message' => 'Topic created successfully',
            'topic' => $topic->load(['subject:id,name,slug,school_id,class_id', 'subject.schoolClass:id,name,grade_level'])->loadCount('questions'),
        ], 201);
    }

    public function update(UpdateTopicRequest $request, int $id): JsonResponse
    {
        $user = $request->user();

        $topic = Topic::with('subject')->findOrFail($id);
        Gate::authorize('update', $topic);

        // Only real topic columns (the request also accepts fields topics don't have).
        $validated = Arr::only($request->validated(), ['subject_id', 'name', 'slug', 'level', 'description', 'status', 'sort_order']);
        if (! empty($validated['subject_id']) && (int) $validated['subject_id'] !== $topic->subject_id) {
            Gate::authorize('create', [Topic::class, Subject::findOrFail($validated['subject_id'])]);
        }

        if (! empty($validated['level']) && ! $user->supportsGradeLevel($validated['level'])) {
            throw ValidationException::withMessages(['grade_level' => "Grade level '{$validated['level']}' is not permitted for your school/role."]);
        }

        if (! empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        $topic->update($validated);

        return response()->json([
            'message' => 'Topic updated successfully',
            'topic' => $topic->load('subject:id,name,slug')->loadCount('questions'),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $topic = Topic::with('subject')->findOrFail($id);
        Gate::authorize('delete', $topic);

        $topic->delete();

        return response()->json(['message' => 'Topic deleted successfully']);
    }
}
