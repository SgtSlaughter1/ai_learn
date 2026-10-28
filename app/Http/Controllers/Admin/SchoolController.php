<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveSchoolRequest;
use App\Http\Requests\Admin\UpdateSchoolRequest;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\School;
use App\Support\ListSize;
use App\Support\SearchTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class SchoolController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = School::visibleTo($request->user())
            ->with(['admin:id,name,email'])
            ->withCount(['classes', 'learnerProfiles as learners_count']);

        if ($request->filled('category')) {
            $cat = strtolower($request->category);
            $catId = ['primary' => 1, 'junior' => 2, 'senior' => 3][$cat] ?? null;
            if ($catId) {
                $query->whereJsonContains('category_ids', $catId);
            } elseif ($cat === 'combined') {
                $query->whereJsonLength('category_ids', '>', 1);
            }
        }

        if ($request->has('search')) {
            $search = trim($request->get('search'));
            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', SearchTerm::like($search))
                        ->orWhere('city', 'like', SearchTerm::like($search))
                        ->orWhere('state', 'like', SearchTerm::like($search))
                        ->orWhere('email', 'like', SearchTerm::like($search));
                });
            }
        }

        $perPage = ListSize::from($request->get('per_page'), 50, 100);

        $schools = $query->orderBy('name')->paginate($perPage);

        return response()->json([
            'schools' => $schools->items(),
            'data' => $schools->items(),
            'pagination' => [
                'total' => $schools->total(),
                'per_page' => $schools->perPage(),
                'current_page' => $schools->currentPage(),
                'last_page' => $schools->lastPage(),
                'from' => $schools->firstItem(),
                'to' => $schools->lastItem(),
            ],
            'meta' => [
                'current_page' => $schools->currentPage(),
                'last_page' => $schools->lastPage(),
                'per_page' => $schools->perPage(),
                'total' => $schools->total(),
            ],
        ]);
    }

    public function store(SaveSchoolRequest $request): JsonResponse
    {

        $validated = $request->validated();

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (School::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $school = School::create([
            'name' => $validated['name'],
            'category_ids' => self::normalizeCategoryIds($validated['category_ids'] ?? null),
            'slug' => $slug,
            'address' => $validated['address'] ?? null,
            'city' => $validated['city'] ?? null,
            'state' => $validated['state'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'email' => $validated['email'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'admin_user_id' => $validated['admin_user_id'] ?? null,
        ]);

        return response()->json([
            'message' => 'School created successfully',
            'school' => $school->load('admin:id,name,email')->loadCount(['classes', 'learnerProfiles as learners_count']),
        ], 201);
    }

    public function update(UpdateSchoolRequest $request, int $id): JsonResponse
    {

        $school = School::findOrFail($id);

        $validated = $request->validated();

        if (array_key_exists('category_ids', $validated)) {
            $validated['category_ids'] = self::normalizeCategoryIds($validated['category_ids']);
        }

        if (! empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        $school->update($validated);

        return response()->json([
            'message' => 'School updated successfully',
            'school' => $school->fresh('admin:id,name,email')->loadCount(['classes', 'learnerProfiles as learners_count']),
        ]);
    }

    /** Switch learners' Recess (earned game breaks) on or off for one school. */
    public function updateRecess(Request $request, int $id): JsonResponse
    {
        $school = School::findOrFail($id);
        Gate::authorize('manageLearnerSettings', $school);
        $validated = $request->validate(['enabled' => ['required', 'boolean']]);

        $school->update(['recess_enabled' => $validated['enabled']]);

        return response()->json([
            'message' => $school->recess_enabled ? 'Recess is on for your learners.' : 'Recess is off for your learners.',
            'recess_enabled' => $school->recess_enabled,
        ]);
    }

    public function updateCbt(Request $request, int $id): JsonResponse
    {
        $school = School::findOrFail($id);
        Gate::authorize('manageLearnerSettings', $school);
        $validated = $request->validate(['enabled' => ['required', 'boolean']]);

        $school->update(['cbt_enabled' => $validated['enabled']]);

        return response()->json([
            'message' => $school->cbt_enabled ? 'School CBT is on.' : 'School CBT is off.',
            'cbt_enabled' => $school->cbt_enabled,
        ]);
    }

    /** Sorted, unique category IDs; a school with none is treated as senior secondary. */
    private static function normalizeCategoryIds(?array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids ?? [])));
        sort($ids);

        return $ids ?: [3];
    }

    public function destroy(Request $request, int $id): JsonResponse
    {

        $school = School::findOrFail($id);

        // Deleting would turn the school's private subjects and questions into shared content
        // and orphan its people, so only an empty school can be deleted.
        $inUse = array_filter([
            'classes' => $school->classes()->count(),
            'teachers' => $school->teacherProfiles()->count(),
            'learners' => $school->learnerProfiles()->count(),
            'subjects' => $school->subjects()->count(),
            'questions' => Question::where('school_id', $school->id)->count(),
            'quizzes' => Quiz::where('school_id', $school->id)->count(),
        ]);
        if ($inUse !== []) {
            $summary = collect($inUse)->map(fn ($n, $what) => "{$n} {$what}")->implode(', ');

            return response()->json([
                'message' => "This school still has {$summary}. Deactivate it instead, or remove its content first.",
                'in_use' => $inUse,
            ], 422);
        }

        $school->delete();

        return response()->json(['message' => 'School deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // School Admins Management (Super Admin)
    // ──────────────────────────────────────────────────────────────────────────
}
