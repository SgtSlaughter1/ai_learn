<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SaveSchoolRequest;
use App\Http\Requests\Admin\UpdateSchoolRequest;
use App\Models\School;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            $catIdMap = ['primary' => 1, 'junior' => 2, 'senior' => 3];
            if (isset($catIdMap[$cat])) {
                $targetId = $catIdMap[$cat];
                $query->where(function ($q) use ($cat, $targetId) {
                    $q->where('category', $cat)
                        ->orWhereJsonContains('category_ids', $targetId);
                });
            } elseif ($cat === 'combined') {
                $query->where(function ($q) {
                    $q->where('category', 'combined')
                        ->orWhereRaw('JSON_LENGTH(category_ids) > 1');
                });
            } else {
                $query->where('category', $cat);
            }
        }

        if ($request->has('search')) {
            $search = trim($request->get('search'));
            if ($search !== '') {
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhere('state', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            }
        }

        $perPage = (int) $request->get('per_page', 50);
        $perPage = max(1, min(100, $perPage));

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

        $categoryIds = $validated['category_ids'] ?? null;
        $categoryStr = $validated['category'] ?? null;

        if (! empty($categoryIds)) {
            $sortedIds = array_values(array_unique(array_map('intval', $categoryIds)));
            sort($sortedIds);
            $categoryIds = $sortedIds;
            if (count($categoryIds) === 1) {
                $categoryStr = match ($categoryIds[0]) {
                    1 => 'primary',
                    2 => 'junior',
                    3 => 'senior',
                    default => 'senior',
                };
            } else {
                $categoryStr = 'combined';
            }
        } elseif ($categoryStr) {
            $categoryIds = match (strtolower($categoryStr)) {
                'primary' => [1],
                'junior' => [2],
                'senior' => [3],
                'combined' => [1, 2, 3],
                default => [3],
            };
        } else {
            $categoryIds = [3];
            $categoryStr = 'senior';
        }

        $slug = ! empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (School::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $school = School::create([
            'name' => $validated['name'],
            'category' => $categoryStr,
            'category_ids' => $categoryIds,
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
            $categoryIds = $validated['category_ids'];
            if (! empty($categoryIds)) {
                $sortedIds = array_values(array_unique(array_map('intval', $categoryIds)));
                sort($sortedIds);
                $validated['category_ids'] = $sortedIds;
                if (count($sortedIds) === 1) {
                    $validated['category'] = match ($sortedIds[0]) {
                        1 => 'primary',
                        2 => 'junior',
                        3 => 'senior',
                        default => 'senior',
                    };
                } else {
                    $validated['category'] = 'combined';
                }
            } else {
                $validated['category_ids'] = [3];
                $validated['category'] = 'senior';
            }
        } elseif (! empty($validated['category'])) {
            $validated['category_ids'] = match (strtolower($validated['category'])) {
                'primary' => [1],
                'junior' => [2],
                'senior' => [3],
                'combined' => [1, 2, 3],
                default => [3],
            };
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

    public function destroy(Request $request, int $id): JsonResponse
    {

        $school = School::findOrFail($id);
        $school->delete();

        return response()->json(['message' => 'School deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // School Admins Management (Super Admin)
    // ──────────────────────────────────────────────────────────────────────────
}
