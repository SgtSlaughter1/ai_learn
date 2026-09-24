<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Program;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    public function index(Request $request): mixed
    {
        $this->authorizeAdmin($request);
        return Inertia::render('admin/Dashboard');
    }

    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $isSuperAdmin = $user->isPlatformAdmin();
        $school = $user->isSchoolAdmin() ? $user->primarySchool() : null;
        $schoolId = $school?->id;

        // Platform & School counts
        $totalSchools = School::where('is_active', true)->count();
        $totalSchoolAdmins = User::where('role', 'school_admin')->count();

        // Teachers query scoped by school if school_admin
        $teachersQuery = User::where('role', 'teacher');
        if (!$isSuperAdmin && $schoolId) {
            $teachersQuery->whereHas('teacherProfile', fn ($q) => $q->where('school_id', $schoolId));
        }
        $totalTeachers = $teachersQuery->count();

        // Learners query scoped by school if school_admin
        $learnersQuery = User::where('role', 'learner');
        if (!$isSuperAdmin && $schoolId) {
            $learnersQuery->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $schoolId));
        }
        $totalLearners = $learnersQuery->count();

        // Classes query scoped by school if school_admin
        $classesQuery = ClassModel::where('is_active', true);
        if (!$isSuperAdmin && $schoolId) {
            $classesQuery->where('school_id', $schoolId);
        }
        $totalClasses = $classesQuery->count();

        $totalSubjects = Subject::where('status', 'active')->count();
        $totalTopics = Topic::where('status', 'active')->count();
        $totalQuizzes = Quiz::where('status', 'active')->count();
        $totalQuestions = Question::where('status', 'active')->count();

        // Activity stats (single query on learner_progress, scoped if school_admin)
        $progressQuery = LearnerProgress::query();
        if (!$isSuperAdmin && $schoolId) {
            $progressQuery->whereHas('user.learnerProfile', fn ($q) => $q->where('school_id', $schoolId));
        }

        $progressAggregates = $progressQuery->selectRaw('
            SUM(questions_attempted) as total_answered,
            SUM(questions_correct) as total_correct,
            AVG(mastery_score) as avg_mastery
        ')->first();

        $totalQuestionsAnswered = (int) ($progressAggregates?->total_answered ?? 0);
        $avgMastery = (int) round($progressAggregates?->avg_mastery ?? 0);

        $attemptsQuery = QuizAttempt::where('status', 'completed');
        if (!$isSuperAdmin && $schoolId) {
            $attemptsQuery->whereHas('user.learnerProfile', fn ($q) => $q->where('school_id', $schoolId));
        }
        $totalAttempts = $attemptsQuery->count();

        // Grade Level Distribution
        $gradeDistQuery = LearnerProfile::whereNotNull('grade_level');
        if (!$isSuperAdmin && $schoolId) {
            $gradeDistQuery->where('school_id', $schoolId);
        }
        $gradeDistribution = $gradeDistQuery->selectRaw('grade_level, count(*) as count')
            ->groupBy('grade_level')
            ->pluck('count', 'grade_level')
            ->toArray();

        // Top Performing Learners by XP (optimized at database level with indexed order and limit)
        $topLearners = DB::table('users as u')
            ->join('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->leftJoin('learner_profiles as lp', 'lp.user_id', '=', 'u.id')
            ->leftJoin('schools as s', 's.id', '=', 'lp.school_id')
            ->where('u.role', 'learner')
            ->where('ug.total_xp', '>', 0)
            ->when(!$isSuperAdmin && $schoolId, fn ($q) => $q->where('lp.school_id', $schoolId))
            ->select([
                'u.id',
                'u.name',
                'u.email',
                DB::raw('COALESCE(s.name, "Primary School") as school'),
                DB::raw('COALESCE(lp.grade_level, "SS1") as grade_level'),
                DB::raw('COALESCE(ug.total_xp, 0) as total_xp'),
                DB::raw("COALESCE(ug.tier, 'Newcomer') as tier"),
                DB::raw('COALESCE(ug.level, 1) as level'),
            ])
            ->orderByDesc('ug.total_xp')
            ->limit(5)
            ->get()
            ->map(fn ($u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'school' => $u->school,
                'grade_level' => $u->grade_level,
                'total_xp' => (int) $u->total_xp,
                'tier' => $u->tier,
                'level' => (int) $u->level,
            ]);

        // Struggling learners (avg mastery < 40%)
        $strugglingQuery = DB::table('users as u')
            ->join('learner_progress as lp', 'lp.user_id', '=', 'u.id')
            ->leftJoin('learner_profiles as lprof', 'lprof.user_id', '=', 'u.id')
            ->leftJoin('schools as s', 's.id', '=', 'lprof.school_id');

        if (!$isSuperAdmin && $schoolId) {
            $strugglingQuery->where('lprof.school_id', $schoolId);
        }

        $strugglingLearners = $strugglingQuery
            ->groupBy('u.id', 'u.name', 'u.email', 's.name', 'lprof.grade_level')
            ->havingRaw('AVG(lp.mastery_score) < 40')
            ->select([
                'u.id',
                'u.name',
                'u.email',
                DB::raw('COALESCE(s.name, "Primary School") as school'),
                DB::raw('COALESCE(lprof.grade_level, "SS1") as grade_level'),
                DB::raw('ROUND(AVG(lp.mastery_score)) as avg_mastery'),
                DB::raw('SUM(lp.questions_attempted) as questions_attempted'),
            ])
            ->take(5)
            ->get();

        return response()->json([
            'is_super_admin' => $isSuperAdmin,
            'role' => $user->role?->value ?? $user->role,
            'school' => $school ? ['id' => $school->id, 'name' => $school->name] : null,
            'overview' => [
                'total_schools' => $totalSchools,
                'total_school_admins' => $totalSchoolAdmins,
                'total_teachers' => $totalTeachers,
                'total_learners' => $totalLearners,
                'total_classes' => $totalClasses,
                'total_subjects' => $totalSubjects,
                'total_topics' => $totalTopics,
                'total_quizzes' => $totalQuizzes,
                'total_questions' => $totalQuestions,
                'total_attempts' => $totalAttempts,
                'total_questions_answered' => $totalQuestionsAnswered,
                'avg_mastery' => $avgMastery,
                'struggling_learners' => $strugglingLearners->count(),
            ],
            'top_learners' => $topLearners,
            'struggling_learners' => $strugglingLearners,
            'grade_distribution' => $gradeDistribution,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Schools Management (Super Admin)
    // ──────────────────────────────────────────────────────────────────────────

    public function getSchools(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();

        $query = School::with(['admin:id,name,email'])
            ->withCount(['classes', 'learnerProfiles as learners_count']);

        // If School Admin, only return their assigned school
        if (!$isSuperAdmin) {
            $query->where('admin_user_id', $user->id);
        }

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

        $perPage = (int) $request->get('per_page', 15);
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

    public function getCategories(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $categories = Category::orderBy('id')->get();
        return response()->json([
            'categories' => $categories,
        ]);
    }

    public function saveSchool(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|in:primary,junior,senior,combined',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|in:1,2,3',
            'slug' => 'nullable|string|max:255|unique:schools,slug',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|string|email|max:255',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'admin_user_id' => 'nullable|exists:users,id',
        ]);

        $categoryIds = $validated['category_ids'] ?? null;
        $categoryStr = $validated['category'] ?? null;

        if (!empty($categoryIds)) {
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
                'junior'  => [2],
                'senior'  => [3],
                'combined'=> [1, 2, 3],
                default   => [3],
            };
        } else {
            $categoryIds = [3];
            $categoryStr = 'senior';
        }

        $slug = !empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
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

    public function updateSchool(Request $request, int $id): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $school = School::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'category' => 'nullable|string|in:primary,junior,senior,combined',
            'category_ids' => 'nullable|array',
            'category_ids.*' => 'integer|in:1,2,3',
            'slug' => 'nullable|string|max:255|unique:schools,slug,' . $id,
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|string|email|max:255',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'admin_user_id' => 'nullable|exists:users,id',
        ]);

        if (array_key_exists('category_ids', $validated)) {
            $categoryIds = $validated['category_ids'];
            if (!empty($categoryIds)) {
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
        } elseif (!empty($validated['category'])) {
            $validated['category_ids'] = match (strtolower($validated['category'])) {
                'primary' => [1],
                'junior'  => [2],
                'senior'  => [3],
                'combined'=> [1, 2, 3],
                default   => [3],
            };
        }

        if (!empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        $school->update($validated);

        return response()->json([
            'message' => 'School updated successfully',
            'school' => $school->fresh('admin:id,name,email')->loadCount(['classes', 'learnerProfiles as learners_count']),
        ]);
    }

    public function deleteSchool(Request $request, int $id): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $school = School::findOrFail($id);
        $school->delete();

        return response()->json(['message' => 'School deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // School Admins Management (Super Admin)
    // ──────────────────────────────────────────────────────────────────────────

    public function getSchoolAdmins(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

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
            });

        return response()->json(['school_admins' => $admins, 'data' => $admins]);
    }

    public function saveSchoolAdmin(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'school_id' => 'nullable|exists:schools,id',
        ]);

        $user = DB::transaction(function () use ($validated) {
            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::SCHOOL_ADMIN,
            ]);

            if (!empty($validated['school_id'])) {
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

    public function updateSchoolAdmin(Request $request, string $id): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $user = User::where('id', $id)->whereIn('role', ['platform_admin', 'school_admin'])->firstOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'school_id' => 'nullable|exists:schools,id',
        ]);

        DB::transaction(function () use ($user, $validated) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (!empty($validated['password'])) {
                $userData['password'] = Hash::make($validated['password']);
            }
            $user->update($userData);

            // Re-assign school if requested
            if (array_key_exists('school_id', $validated)) {
                // Clear any previous school pointing to this admin
                School::where('admin_user_id', $user->id)->update(['admin_user_id' => null]);
                
                if (!empty($validated['school_id'])) {
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

    public function deleteSchoolAdmin(Request $request, string $id): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $user = User::where('id', $id)->whereIn('role', ['admin', 'school_admin'])->firstOrFail();
        
        // Unlink school admin from schools
        School::where('admin_user_id', $user->id)->update(['admin_user_id' => null]);
        $user->delete();

        return response()->json(['message' => 'School Admin removed successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Teachers Management (School Admin & Super Admin)
    // ──────────────────────────────────────────────────────────────────────────

    public function getTeachers(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $query = User::where('role', 'teacher')
            ->with([
                'teacherProfile.school:id,name',
                'classes' => function ($q) {
                    $q->wherePivot('role', 'teacher')
                      ->select(['classes.id', 'classes.name', 'classes.grade_level', 'classes.arm', 'classes.section']);
                },
            ]);

        if (!$isSuperAdmin && $schoolId) {
            $query->whereHas('teacherProfile', fn ($q) => $q->where('school_id', $schoolId));
        } elseif ($request->filled('school_id')) {
            $query->whereHas('teacherProfile', fn ($q) => $q->where('school_id', $request->school_id));
        }

        if ($request->filled('class_id')) {
            $query->whereHas('classMemberships', fn ($q) => $q->where('class_id', $request->class_id)->where('role', 'teacher'));
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhereHas('teacherProfile', fn ($tp) => $tp->where('employee_id', 'like', "%{$search}%")->orWhere('department', 'like', "%{$search}%"));
            });
        }

        $perPage = (int) $request->get('per_page', 20);
        $teachers = $query->orderBy('name')->paginate($perPage);

        return response()->json($teachers);
    }

    public function saveTeacher(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'school_id' => $isSuperAdmin ? 'required|exists:schools,id' : 'nullable|exists:schools,id',
            'class_id' => 'nullable|exists:classes,id',
            'class_ids' => 'nullable|array',
            'class_ids.*' => 'exists:classes,id',
            'department' => 'nullable|string|max:100',
            'employee_id' => 'nullable|string|max:50',
            'bio' => 'nullable|string',
        ]);

        $targetSchoolId = $isSuperAdmin ? ($validated['school_id'] ?? $schoolId) : $schoolId;

        $teacherUser = DB::transaction(function () use ($validated, $targetSchoolId) {
            $teacher = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::TEACHER,
            ]);

            \App\Models\TeacherProfile::create([
                'user_id' => $teacher->id,
                'school_id' => $targetSchoolId,
                'employee_id' => $validated['employee_id'] ?? null,
                'department' => $validated['department'] ?? null,
                'bio' => $validated['bio'] ?? null,
                'is_active' => true,
            ]);

            $classIds = [];
            if (!empty($validated['class_ids'])) {
                $classIds = $validated['class_ids'];
            } elseif (!empty($validated['class_id'])) {
                $classIds = [$validated['class_id']];
            }

            foreach ($classIds as $cId) {
                ClassMembership::updateOrCreate(
                    ['class_id' => $cId, 'user_id' => $teacher->id],
                    ['role' => 'teacher', 'is_active' => true]
                );
            }

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

    public function updateTeacher(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $teacherUser = User::where('id', $id)->where('role', 'teacher')->firstOrFail();

        if (!$isSuperAdmin && $schoolId) {
            $belongsToSchool = $teacherUser->teacherProfile()->where('school_id', $schoolId)->exists();
            if (!$belongsToSchool) {
                return response()->json(['error' => 'Forbidden. This teacher does not belong to your school.'], 403);
            }
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'school_id' => 'nullable|exists:schools,id',
            'class_id' => 'nullable|exists:classes,id',
            'class_ids' => 'nullable|array',
            'class_ids.*' => 'exists:classes,id',
            'department' => 'nullable|string|max:100',
            'employee_id' => 'nullable|string|max:50',
            'bio' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        DB::transaction(function () use ($teacherUser, $validated, $isSuperAdmin) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (!empty($validated['password'])) {
                $userData['password'] = Hash::make($validated['password']);
            }
            $teacherUser->update($userData);

            $profileData = [];
            if (array_key_exists('department', $validated)) $profileData['department'] = $validated['department'];
            if (array_key_exists('employee_id', $validated)) $profileData['employee_id'] = $validated['employee_id'];
            if (array_key_exists('bio', $validated)) $profileData['bio'] = $validated['bio'];
            if (array_key_exists('is_active', $validated)) $profileData['is_active'] = $validated['is_active'];
            if ($isSuperAdmin && !empty($validated['school_id'])) $profileData['school_id'] = $validated['school_id'];

            if (!empty($profileData)) {
                $teacherUser->teacherProfile()->updateOrCreate(['user_id' => $teacherUser->id], $profileData);
            }

            // Sync classes if provided
            if (array_key_exists('class_ids', $validated) || array_key_exists('class_id', $validated)) {
                $classIds = [];
                if (isset($validated['class_ids'])) {
                    $classIds = $validated['class_ids'];
                } elseif (!empty($validated['class_id'])) {
                    $classIds = [$validated['class_id']];
                }

                ClassMembership::where('user_id', $teacherUser->id)
                    ->where('role', 'teacher')
                    ->whereNotIn('class_id', $classIds)
                    ->delete();

                foreach ($classIds as $cId) {
                    ClassMembership::updateOrCreate(
                        ['class_id' => $cId, 'user_id' => $teacherUser->id],
                        ['role' => 'teacher', 'is_active' => true]
                    );
                }
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

    public function deleteTeacher(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $teacherUser = User::where('id', $id)->where('role', 'teacher')->firstOrFail();

        if (!$isSuperAdmin && $schoolId) {
            $belongsToSchool = $teacherUser->teacherProfile()->where('school_id', $schoolId)->exists();
            if (!$belongsToSchool) {
                return response()->json(['error' => 'Forbidden. This teacher does not belong to your school.'], 403);
            }
        }

        DB::transaction(function () use ($teacherUser) {
            ClassMembership::where('user_id', $teacherUser->id)->delete();
            $teacherUser->teacherProfile()->delete();
            $teacherUser->delete();
        });

        return response()->json(['message' => 'Teacher deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Learners Management
    // ──────────────────────────────────────────────────────────────────────────

    public function getLearners(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $query = User::where('role', 'learner')
            ->with([
                'learnerProfile.school:id,name',
                'gamification:id,user_id,total_xp,level,tier',
                'classes:id,name,grade_level,arm,section,program_id',
                'classes.program:id,name,code',
            ]);

        if (!$isSuperAdmin && $schoolId) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $schoolId));
        } elseif ($request->filled('school_id')) {
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
            ->paginate($request->get('per_page', 20));

        return response()->json($learners);
    }

    public function saveLearner(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $authUser = $request->user();
        $isSchoolAdmin = $authUser && $authUser->isSchoolAdmin();
        $schoolAdminSchoolId = $isSchoolAdmin ? $authUser->primarySchool()?->id : null;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'school_id' => $isSchoolAdmin ? 'nullable|exists:schools,id' : 'nullable|exists:schools,id',
            'grade_level' => 'nullable|string|max:50',
            'student_id' => 'nullable|string|max:50',
            'class_id' => 'nullable|exists:classes,id',
        ]);

        if ($isSchoolAdmin && $schoolAdminSchoolId) {
            $validated['school_id'] = $schoolAdminSchoolId;
        }

        $targetSchool = !empty($validated['school_id']) ? School::find($validated['school_id']) : null;

        if (!empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if (!$targetClass) {
                return response()->json(['error' => 'Selected class does not exist.'], 422);
            }
            if ($targetSchool && $targetClass->school_id !== $targetSchool->id) {
                return response()->json(['error' => 'The selected class does not belong to the selected school.'], 422);
            }
            if ($targetSchool && !$targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                return response()->json(['error' => "Class grade level ({$targetClass->grade_level}) is not supported by the school's category ({$targetSchool->category})."], 422);
            }
            if (empty($validated['grade_level'])) {
                $validated['grade_level'] = $targetClass->grade_level;
            }
        }

        if (!empty($validated['grade_level']) && $targetSchool && !$targetSchool->supportsGradeLevel($validated['grade_level'])) {
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

            if (!empty($validated['class_id'])) {
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

    public function updateLearner(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $authUser = $request->user();
        $isSchoolAdmin = $authUser && $authUser->isSchoolAdmin();
        $schoolAdminSchoolId = $isSchoolAdmin ? $authUser->primarySchool()?->id : null;

        $user = User::where('id', $id)->where('role', 'learner')->firstOrFail();

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $id,
            'password' => 'nullable|string|min:6',
            'school_id' => 'nullable|exists:schools,id',
            'grade_level' => 'nullable|string|max:50',
            'student_id' => 'nullable|string|max:50',
            'is_active' => 'nullable|boolean',
            'class_id' => 'nullable|exists:classes,id',
        ]);

        if ($isSchoolAdmin && $schoolAdminSchoolId) {
            $validated['school_id'] = $schoolAdminSchoolId;
        }

        $effectiveSchoolId = $validated['school_id'] ?? $user->learnerProfile?->school_id;
        $targetSchool = $effectiveSchoolId ? School::find($effectiveSchoolId) : null;

        if (!empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if (!$targetClass) {
                return response()->json(['error' => 'Selected class does not exist.'], 422);
            }
            if ($targetSchool && $targetClass->school_id !== $targetSchool->id) {
                return response()->json(['error' => 'The selected class does not belong to the selected school.'], 422);
            }
            if ($targetSchool && !$targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                return response()->json(['error' => "Class grade level ({$targetClass->grade_level}) is not supported by the school's category ({$targetSchool->category})."], 422);
            }
        }

        if (!empty($validated['grade_level']) && $targetSchool && !$targetSchool->supportsGradeLevel($validated['grade_level'])) {
            return response()->json(['error' => "Grade level {$validated['grade_level']} is not supported by the school's category ({$targetSchool->category})."], 422);
        }

        DB::transaction(function () use ($user, $validated) {
            $userData = [
                'name' => $validated['name'],
                'email' => $validated['email'],
            ];
            if (!empty($validated['password'])) {
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

    public function deleteLearner(Request $request, string $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $user = User::where('id', $id)->where('role', 'learner')->firstOrFail();
        $user->delete();

        return response()->json(['message' => 'Learner deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Subjects & Topics Management
    // ──────────────────────────────────────────────────────────────────────────

    public function getSubjects(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $isTeacher = $user->isTeacher();
        $schoolId = ($user->isSchoolAdmin() || $isTeacher) ? $user->primarySchool()?->id : null;

        $query = Subject::withCount(['topics'])
            ->with([
                'school:id,name',
                'schoolClass:id,name,grade_level,section',
                'topics' => function ($q) {
                    $q->withCount('questions')->orderBy('sort_order');
                }
            ]);

        if ($isTeacher) {
            $teacherClassIds = $user->classes()->pluck('classes.id')->toArray();
            if (!empty($teacherClassIds)) {
                $query->whereIn('class_id', $teacherClassIds);
            } else {
                $query->whereRaw('1 = 0');
            }
        } elseif (!$isSuperAdmin && $schoolId) {
            $query->where(function ($q) use ($schoolId) {
                $q->where('school_id', $schoolId)->orWhereNull('school_id');
            });
        }

        if ($request->filled('class_id')) {
            $query->where('class_id', $request->class_id);
        }

        $subjects = $query->orderBy('sort_order')->orderBy('name')->get();

        return response()->json(['subjects' => $subjects]);
    }

    public function saveSubject(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subjects,slug',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'sort_order' => 'nullable|integer',
            'school_id' => 'nullable|exists:schools,id',
            'class_id' => 'nullable|exists:classes,id',
        ]);

        $slug = !empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (Subject::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $targetClass = !empty($validated['class_id']) ? ClassModel::find($validated['class_id']) : null;
        if (!empty($validated['class_id']) && !$targetClass) {
            return response()->json(['error' => 'Selected class does not exist.'], 422);
        }

        if (!$isSuperAdmin && $schoolId && $targetClass && $targetClass->school_id !== $schoolId) {
            return response()->json(['error' => 'The selected class does not belong to your school.'], 403);
        }

        $assignedSchoolId = $isSuperAdmin
            ? ($validated['school_id'] ?? $targetClass?->school_id)
            : ($schoolId ?? $targetClass?->school_id);

        if ($targetClass && $assignedSchoolId && $targetClass->school_id !== (int) $assignedSchoolId) {
            return response()->json(['error' => 'The selected class does not belong to the designated school.'], 422);
        }

        $targetSchool = $assignedSchoolId ? School::find($assignedSchoolId) : null;
        if ($targetClass && $targetSchool && !$targetSchool->supportsGradeLevel($targetClass->grade_level)) {
            return response()->json(['error' => "The selected class grade level ({$targetClass->grade_level}) is not permitted under school category ({$targetSchool->category})."], 422);
        }

        $subject = Subject::create([
            'school_id' => $assignedSchoolId,
            'class_id' => $validated['class_id'] ?? null,
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

    public function updateSubject(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $subject = Subject::findOrFail($id);

        if (!$isSuperAdmin && $schoolId && $subject->school_id && $subject->school_id !== $schoolId) {
            return response()->json(['error' => 'You do not have permission to update subjects from another school.'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subjects,slug,' . $id,
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'sort_order' => 'nullable|integer',
            'class_id' => 'nullable|exists:classes,id',
            'school_id' => 'nullable|exists:schools,id',
        ]);

        if (!empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        if (array_key_exists('class_id', $validated) && !empty($validated['class_id'])) {
            $targetClass = ClassModel::find($validated['class_id']);
            if ($targetClass) {
                if (!$isSuperAdmin && $schoolId && $targetClass->school_id !== $schoolId) {
                    return response()->json(['error' => 'The selected class does not belong to your school.'], 403);
                }

                $effectiveSchoolId = $validated['school_id'] ?? $subject->school_id ?? $targetClass->school_id;
                if ($effectiveSchoolId && $targetClass->school_id !== (int) $effectiveSchoolId) {
                    return response()->json(['error' => 'The selected class does not belong to the designated school.'], 422);
                }

                $targetSchool = $effectiveSchoolId ? School::find($effectiveSchoolId) : null;
                if ($targetSchool && !$targetSchool->supportsGradeLevel($targetClass->grade_level)) {
                    return response()->json(['error' => "The selected class grade level ({$targetClass->grade_level}) is not permitted under school category ({$targetSchool->category})."], 422);
                }

                if (empty($validated['school_id']) && !$subject->school_id && $targetClass->school_id) {
                    $validated['school_id'] = $targetClass->school_id;
                }
            }
        }

        $subject->update($validated);

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject->fresh(['school:id,name', 'schoolClass:id,name,grade_level'])->loadCount('topics'),
        ]);
    }

    public function deleteSubject(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $subject = Subject::findOrFail($id);
        $subject->delete();

        return response()->json(['message' => 'Subject deleted successfully']);
    }

    public function getTopics(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);
        $user = $request->user();
        $isTeacher = $user && $user->isTeacher();
        $schoolId = ($user && ($user->isSchoolAdmin() || $isTeacher)) ? $user->primarySchool()?->id : null;

        $query = Topic::with(['subject:id,name,slug,school_id,class_id', 'subject.schoolClass:id,name,grade_level'])->withCount('questions');

        if ($isTeacher) {
            $teacherClassIds = $user->classes()->pluck('classes.id')->toArray();
            if (!empty($teacherClassIds)) {
                $query->whereHas('subject', fn ($sub) => $sub->whereIn('class_id', $teacherClassIds));
            } else {
                $query->whereRaw('1 = 0');
            }
        }

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

        return response()->json(['topics' => $topics]);
    }

    public function saveTopic(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'subject_id' => 'required|exists:subjects,id',
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'level' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'sort_order' => 'nullable|integer',
        ]);

        $slug = !empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (Topic::where('subject_id', $validated['subject_id'])->where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $subject = Subject::with('schoolClass')->find($validated['subject_id']);
        $inferredLevel = $validated['level'] ?? ($subject?->schoolClass?->grade_level ? strtoupper($subject->schoolClass->grade_level) : 'SS1');

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

    public function updateTopic(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $topic = Topic::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'level' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'sort_order' => 'nullable|integer',
        ]);

        if (!empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        $topic->update($validated);

        return response()->json([
            'message' => 'Topic updated successfully',
            'topic' => $topic->load('subject:id,name,slug')->loadCount('questions'),
        ]);
    }

    public function deleteTopic(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $topic = Topic::findOrFail($id);
        $topic->delete();

        return response()->json(['message' => 'Topic deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Questions Management
    // ──────────────────────────────────────────────────────────────────────────

    public function getQuestions(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $isTeacher = $user->isTeacher();
        $schoolId = ($user->isSchoolAdmin() || $isTeacher) ? $user->primarySchool()?->id : null;

        $query = Question::with([
            'options',
            'topic.subject:id,name,slug,school_id,class_id',
            'topic.subject.schoolClass:id,name,grade_level',
            'school:id,name'
        ]);

        if ($isTeacher) {
            $teacherClassIds = $user->classes()->pluck('classes.id')->toArray();
            if (!empty($teacherClassIds)) {
                $query->whereHas('topic.subject', fn ($sub) => $sub->whereIn('class_id', $teacherClassIds));
            } else {
                $query->whereRaw('1 = 0');
            }
        } elseif (!$isSuperAdmin && $schoolId) {
            $query->where(function ($q) use ($schoolId) {
                $q->where('questions.school_id', $schoolId)
                  ->orWhereNull('questions.school_id')
                  ->orWhereHas('topic.subject', fn ($sub) => $sub->where('school_id', $schoolId));
            });
        }

        if ($request->filled('topic_id')) {
            $query->where('topic_id', $request->topic_id);
        } elseif ($request->filled('subject_id')) {
            $query->whereHas('topic', fn ($q) => $q->where('subject_id', $request->subject_id));
        } elseif ($request->filled('class_id')) {
            $query->whereHas('topic.subject', fn ($q) => $q->where('class_id', $request->class_id));
        }

        if ($request->filled('difficulty')) {
            $query->where('difficulty', $request->difficulty);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where('question_text', 'like', "%{$search}%");
        }

        $questions = $query->orderByDesc('id')->paginate($request->get('per_page', 15));

        return response()->json($questions);
    }

    public function saveQuestion(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $isTeacher = $user->isTeacher();
        $schoolId = ($user->isSchoolAdmin() || $isTeacher) ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'topic_id' => 'required|exists:topics,id',
            'question_text' => 'required|string',
            'type' => 'nullable|string|in:multiple_choice,true_false,short_answer',
            'difficulty' => 'nullable|string|in:easy,medium,hard',
            'explanation' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'school_id' => 'nullable|exists:schools,id',
            'options' => 'required|array|min:2',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct' => 'required|boolean',
            'options.*.sort_order' => 'nullable|integer',
        ]);

        $question = DB::transaction(function () use ($validated, $isSuperAdmin, $schoolId) {
            $topic = Topic::with('subject')->find($validated['topic_id']);
            $assignedSchoolId = $isSuperAdmin
                ? ($validated['school_id'] ?? $topic?->subject?->school_id)
                : ($schoolId ?? $topic?->subject?->school_id);

            $question = Question::create([
                'topic_id' => $validated['topic_id'],
                'school_id' => $assignedSchoolId,
                'question_text' => $validated['question_text'],
                'type' => $validated['type'] ?? 'multiple_choice',
                'difficulty' => $validated['difficulty'] ?? 'medium',
                'explanation' => $validated['explanation'] ?? null,
                'status' => $validated['status'] ?? 'active',
            ]);

            foreach ($validated['options'] as $index => $opt) {
                QuestionOption::create([
                    'question_id' => $question->id,
                    'option_text' => $opt['option_text'],
                    'is_correct' => (bool) $opt['is_correct'],
                    'sort_order' => $opt['sort_order'] ?? $index,
                ]);
            }

            // Auto-link question to subject assessment quiz so learners can take it immediately
            if ($topic && $topic->subject) {
                $subjectName = $topic->subject->name;
                $quiz = Quiz::firstOrCreate(
                    [
                        'title' => "{$subjectName} Assessment & Practice",
                        'school_id' => $assignedSchoolId,
                    ],
                    [
                        'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                        'time_limit_minutes' => 30,
                        'status' => 'active',
                    ]
                );

                if (!$quiz->questions()->where('questions.id', $question->id)->exists()) {
                    $maxSort = (int) $quiz->questions()->max('quiz_questions.sort_order');
                    $quiz->questions()->attach($question->id, [
                        'sort_order' => $maxSort + 1,
                        'marks' => 2,
                    ]);
                }
            }

            return $question;
        });

        return response()->json([
            'message' => 'Question created successfully',
            'question' => $question->load(['options', 'topic.subject:id,name', 'school:id,name']),
        ], 201);
    }

    public function aiExtractQuestions(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);

        $validated = $request->validate([
            'raw_text' => 'required|string',
            'subject_id' => 'nullable|exists:subjects,id',
            'topic_id' => 'nullable|exists:topics,id',
        ]);

        $subjectName = null;
        if (!empty($validated['subject_id'])) {
            $subject = Subject::find($validated['subject_id']);
            $subjectName = $subject?->name;
        }

        $topicName = null;
        if (!empty($validated['topic_id'])) {
            $topic = Topic::with('subject')->find($validated['topic_id']);
            $topicName = $topic?->name;
            if (!$subjectName && $topic?->subject) {
                $subjectName = $topic->subject->name;
            }
        }

        $aiService = app(\App\Services\AIService::class);
        $extracted = $aiService->extractAndSolveQuestions($validated['raw_text'], $subjectName, $topicName);

        return response()->json([
            'count' => count($extracted),
            'questions' => $extracted,
        ]);
    }

    public function bulkSaveQuestions(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $isTeacher = $user->isTeacher();
        $schoolId = ($user->isSchoolAdmin() || $isTeacher) ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'topic_id' => 'required|exists:topics,id',
            'school_id' => 'nullable|exists:schools,id',
            'questions' => 'required|array|min:1',
            'questions.*.question_text' => 'required|string',
            'questions.*.type' => 'nullable|string|in:multiple_choice,true_false,short_answer',
            'questions.*.difficulty' => 'nullable|string|in:easy,medium,hard',
            'questions.*.explanation' => 'nullable|string',
            'questions.*.status' => 'nullable|string|in:active,inactive',
            'questions.*.options' => 'required|array|min:2',
            'questions.*.options.*.option_text' => 'required|string',
            'questions.*.options.*.is_correct' => 'required|boolean',
            'questions.*.options.*.sort_order' => 'nullable|integer',
        ]);

        $createdQuestions = DB::transaction(function () use ($validated, $isSuperAdmin, $schoolId) {
            $topic = Topic::with('subject')->find($validated['topic_id']);
            $assignedSchoolId = $isSuperAdmin
                ? ($validated['school_id'] ?? $topic?->subject?->school_id)
                : ($schoolId ?? $topic?->subject?->school_id);

            $results = [];

            // Prepare Quiz for auto-linking
            $quiz = null;
            if ($topic && $topic->subject) {
                $subjectName = $topic->subject->name;
                $quiz = Quiz::firstOrCreate(
                    [
                        'title' => "{$subjectName} Assessment & Practice",
                        'school_id' => $assignedSchoolId,
                    ],
                    [
                        'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                        'time_limit_minutes' => 30,
                        'status' => 'active',
                    ]
                );
            }

            foreach ($validated['questions'] as $qData) {
                $question = Question::create([
                    'topic_id' => $validated['topic_id'],
                    'school_id' => $assignedSchoolId,
                    'question_text' => $qData['question_text'],
                    'type' => $qData['type'] ?? 'multiple_choice',
                    'difficulty' => $qData['difficulty'] ?? 'medium',
                    'explanation' => $qData['explanation'] ?? null,
                    'status' => $qData['status'] ?? 'active',
                ]);

                foreach ($qData['options'] as $index => $opt) {
                    QuestionOption::create([
                        'question_id' => $question->id,
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool) $opt['is_correct'],
                        'sort_order' => $opt['sort_order'] ?? $index,
                    ]);
                }

                if ($quiz && !$quiz->questions()->where('questions.id', $question->id)->exists()) {
                    $maxSort = (int) $quiz->questions()->max('quiz_questions.sort_order');
                    $quiz->questions()->attach($question->id, [
                        'sort_order' => $maxSort + 1,
                        'marks' => 2,
                    ]);
                }

                $results[] = $question->load(['options', 'topic.subject:id,name', 'school:id,name']);
            }

            return $results;
        });

        return response()->json([
            'success' => true,
            'message' => count($createdQuestions) . ' questions imported successfully',
            'count' => count($createdQuestions),
            'questions' => $createdQuestions,
        ], 201);
    }

    public function updateQuestion(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);
        $user = $request->user();
        $isSuperAdmin = $user->isPlatformAdmin();
        $isTeacher = $user->isTeacher();
        $schoolId = ($user->isSchoolAdmin() || $isTeacher) ? $user->primarySchool()?->id : null;

        $question = Question::findOrFail($id);

        $validated = $request->validate([
            'topic_id' => 'required|exists:topics,id',
            'question_text' => 'required|string',
            'type' => 'nullable|string|in:multiple_choice,true_false,short_answer',
            'difficulty' => 'nullable|string|in:easy,medium,hard',
            'explanation' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'school_id' => 'nullable|exists:schools,id',
            'options' => 'required|array|min:2',
            'options.*.option_text' => 'required|string',
            'options.*.is_correct' => 'required|boolean',
            'options.*.sort_order' => 'nullable|integer',
        ]);

        DB::transaction(function () use ($question, $validated, $isSuperAdmin, $schoolId) {
            $topic = Topic::with('subject')->find($validated['topic_id']);
            $assignedSchoolId = $isSuperAdmin
                ? ($validated['school_id'] ?? $question->school_id ?? $topic?->subject?->school_id)
                : ($schoolId ?? $question->school_id ?? $topic?->subject?->school_id);

            $question->update([
                'topic_id' => $validated['topic_id'],
                'school_id' => $assignedSchoolId,
                'question_text' => $validated['question_text'],
                'type' => $validated['type'] ?? $question->type,
                'difficulty' => $validated['difficulty'] ?? $question->difficulty,
                'explanation' => $validated['explanation'] ?? null,
                'status' => $validated['status'] ?? $question->status,
            ]);

            // Recreate options
            $question->options()->delete();
            foreach ($validated['options'] as $index => $opt) {
                QuestionOption::create([
                    'question_id' => $question->id,
                    'option_text' => $opt['option_text'],
                    'is_correct' => (bool) $opt['is_correct'],
                    'sort_order' => $opt['sort_order'] ?? $index,
                ]);
            }

            // Ensure question is linked to the subject quiz
            if ($topic && $topic->subject) {
                $subjectName = $topic->subject->name;
                $quiz = Quiz::firstOrCreate(
                    [
                        'title' => "{$subjectName} Assessment & Practice",
                        'school_id' => $assignedSchoolId,
                    ],
                    [
                        'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                        'time_limit_minutes' => 30,
                        'status' => 'active',
                    ]
                );

                if (!$quiz->questions()->where('questions.id', $question->id)->exists()) {
                    $maxSort = (int) $quiz->questions()->max('quiz_questions.sort_order');
                    $quiz->questions()->attach($question->id, [
                        'sort_order' => $maxSort + 1,
                        'marks' => 2,
                    ]);
                }
            }
        });

        return response()->json([
            'message' => 'Question updated successfully',
            'question' => $question->fresh(['options', 'topic.subject:id,name', 'school:id,name']),
        ]);
    }

    public function deleteQuestion(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);

        $question = Question::findOrFail($id);
        $question->delete();

        return response()->json(['message' => 'Question deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Class Cohorts & Roster Management
    // ──────────────────────────────────────────────────────────────────────────

    public function getClasses(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);

        $user = $request->user();
        $isSchoolAdmin = $user && $user->isSchoolAdmin();
        $isTeacher = $user && $user->isTeacher();
        $schoolId = ($isSchoolAdmin || $isTeacher) ? $user->primarySchool()?->id : $request->school_id;

        $gradeOrder = [
            'CRECHE' => 1, 'KG1' => 2, 'KG2' => 3, 'NUR1' => 4, 'NUR2' => 5,
            'PRI1' => 6, 'PRI2' => 7, 'PRI3' => 8, 'PRI4' => 9, 'PRI5' => 10, 'PRI6' => 11,
            'JSS1' => 12, 'JSS2' => 13, 'JSS3' => 14, 'SS1' => 15, 'SS2' => 16, 'SS3' => 17,
        ];

        $classesQuery = ClassModel::with(['school:id,name', 'program:id,name,code,slug'])
            ->withCount(['learnerUsers as learner_count']);

        if ($isTeacher) {
            $classesQuery->whereHas('teachers', fn ($t) => $t->where('user_id', $user->id));
        } elseif ($schoolId) {
            $classesQuery->where('school_id', $schoolId);
        }

        $classes = $classesQuery
            ->when($request->filled('grade_level'), fn ($q) => $q->where('grade_level', $request->grade_level))
            ->when($request->filled('program_id'), fn ($q) => $q->where('program_id', $request->program_id))
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->values();

        $targetSchool = $schoolId ? School::find($schoolId) : null;
        $gradeOptions = $targetSchool ? $targetSchool->grade_options : School::gradeOptionsForCategory($request->category);

        return response()->json([
            'classes' => $classes,
            'grade_options' => $gradeOptions,
            'allowed_grade_levels' => $targetSchool ? $targetSchool->allowed_grade_levels : School::allowedGradeLevelsForCategory($request->category),
        ]);
    }

    public function getPrograms(Request $request): JsonResponse
    {
        $this->authorizeAdminOrTeacher($request);

        $programs = Program::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'slug', 'description']);

        return response()->json(['programs' => $programs]);
    }

    public function saveClass(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $user = $request->user();
        $isSchoolAdmin = $user && $user->isSchoolAdmin();
        $schoolId = $isSchoolAdmin ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'school_id' => $isSchoolAdmin ? 'nullable|exists:schools,id' : 'required|exists:schools,id',
            'program_id' => 'nullable|exists:programs,id',
            'name' => 'required|string|max:100',
            'grade_level' => 'required|string|in:CRECHE,KG1,KG2,NUR1,NUR2,PRI1,PRI2,PRI3,PRI4,PRI5,PRI6,JSS1,JSS2,JSS3,SS1,SS2,SS3',
            'arm' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
        ]);

        $assignedSchoolId = $schoolId ?: $validated['school_id'];
        $targetSchool = School::find($assignedSchoolId);
        if (!$targetSchool) {
            return response()->json(['error' => 'Designated school not found.'], 404);
        }

        if (!$targetSchool->supportsGradeLevel($validated['grade_level'])) {
            return response()->json(['error' => "Grade level '{$validated['grade_level']}' is not permitted for school '{$targetSchool->name}' under category '{$targetSchool->category}'."], 422);
        }

        $slug = Str::slug($validated['name']) . '-' . Str::random(5);
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

    public function updateClass(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSchoolAdmin = $user && $user->isSchoolAdmin();
        $schoolId = $isSchoolAdmin ? $user->primarySchool()?->id : null;

        $class = ClassModel::findOrFail($id);

        if (!$user->isPlatformAdmin() && $schoolId && $class->school_id !== $schoolId) {
            return response()->json(['error' => 'You do not have permission to modify classes from another school.'], 403);
        }

        $validated = $request->validate([
            'school_id' => 'nullable|exists:schools,id',
            'program_id' => 'nullable|exists:programs,id',
            'name' => 'required|string|max:100',
            'grade_level' => 'required|string|in:CRECHE,KG1,KG2,NUR1,NUR2,PRI1,PRI2,PRI3,PRI4,PRI5,PRI6,JSS1,JSS2,JSS3,SS1,SS2,SS3',
            'arm' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $effectiveSchoolId = $validated['school_id'] ?? $class->school_id;
        $targetSchool = School::find($effectiveSchoolId);
        if ($targetSchool && !$targetSchool->supportsGradeLevel($validated['grade_level'])) {
            return response()->json(['error' => "Grade level '{$validated['grade_level']}' is not permitted for school '{$targetSchool->name}' under category '{$targetSchool->category}'."], 422);
        }

        if (isset($validated['arm']) && !isset($validated['section'])) {
            $validated['section'] = $validated['arm'];
        } elseif (isset($validated['section']) && !isset($validated['arm'])) {
            $validated['arm'] = $validated['section'];
        }

        $class->update($validated);

        return response()->json([
            'message' => 'Class updated successfully',
            'class' => $class->fresh(['school:id,name', 'program:id,name,code,slug'])->loadCount(['learnerUsers as learner_count']),
        ]);
    }

    public function deleteClass(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $class = ClassModel::findOrFail($id);
        $class->delete();

        return response()->json(['message' => 'Class deleted successfully']);
    }

    public function getClassLearners(Request $request, int $classId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $class = ClassModel::with('school:id,name')->findOrFail($classId);

        $learnerIds = ClassMembership::where('class_id', $classId)
            ->where('role', 'learner')
            ->where('is_active', true)
            ->pluck('user_id');

        if ($learnerIds->isEmpty()) {
            return response()->json([
                'class' => $class,
                'learners' => [],
            ]);
        }

        $progressMap = DB::table('learner_progress')
            ->whereIn('user_id', $learnerIds)
            ->groupBy('user_id')
            ->selectRaw('
                user_id,
                COUNT(*) as topics_covered,
                AVG(mastery_score) as avg_mastery,
                SUM(questions_attempted) as total_attempted,
                SUM(questions_correct) as total_correct
            ')
            ->get()
            ->keyBy('user_id');

        $learners = DB::table('users as u')
            ->whereIn('u.id', $learnerIds)
            ->leftJoin('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->select([
                'u.id',
                'u.name',
                'u.email',
                DB::raw('COALESCE(ug.level, 1) as level'),
                DB::raw("COALESCE(ug.tier, 'Newcomer') as tier"),
                DB::raw('COALESCE(ug.total_xp, 0) as total_xp'),
                DB::raw('COALESCE(ug.current_streak, 0) as streak'),
            ])
            ->orderByDesc('ug.total_xp')
            ->get()
            ->map(function ($u) use ($progressMap) {
                $p = $progressMap->get($u->id);
                return [
                    'id' => (string) $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'level' => (int) $u->level,
                    'tier' => $u->tier,
                    'total_xp' => (int) $u->total_xp,
                    'streak' => (int) $u->streak,
                    'topics_covered' => (int) ($p?->topics_covered ?? 0),
                    'avg_mastery' => (int) round($p?->avg_mastery ?? 0),
                    'total_attempted' => (int) ($p?->total_attempted ?? 0),
                    'total_correct' => (int) ($p?->total_correct ?? 0),
                ];
            });

        return response()->json([
            'class' => $class,
            'learners' => $learners,
        ]);
    }

    public function enrollClassLearner(Request $request, int $classId): JsonResponse
    {
        $this->authorizeAdmin($request);

        $class = ClassModel::findOrFail($classId);

        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $learner = User::where('email', $validated['email'])->firstOrFail();

        if (!$learner->isLearner()) {
            return response()->json(['error' => 'Selected user is not a learner'], 400);
        }

        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $learner->id)
            ->first();

        if ($membership) {
            $membership->update(['is_active' => true]);
        } else {
            ClassMembership::create([
                'class_id' => $classId,
                'user_id' => $learner->id,
                'role' => 'learner',
                'is_active' => true,
            ]);
        }

        return response()->json(['message' => 'Learner enrolled into class successfully']);
    }

    public function removeClassLearner(Request $request, int $classId, string $learnerId): JsonResponse
    {
        $this->authorizeAdmin($request);

        ClassMembership::where('class_id', $classId)
            ->where('user_id', $learnerId)
            ->where('role', 'learner')
            ->update(['is_active' => false]);

        return response()->json(['message' => 'Learner removed from class']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal Guards
    // ──────────────────────────────────────────────────────────────────────────

    private function authorizeAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            abort(403, 'Forbidden');
        }
    }

    private function authorizeAdminOrTeacher(Request $request): void
    {
        $user = $request->user();
        if (!$user || (!$user->isAdmin() && !$user->isTeacher())) {
            abort(403, 'Forbidden. Admin or Teacher access required.');
        }
    }

    private function authorizeSuperAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !$user->isPlatformAdmin()) {
            abort(403, 'Forbidden. Platform Admin access required.');
        }
    }
}

