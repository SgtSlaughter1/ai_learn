<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
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
        if (!$user || !in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN, UserRole::SCHOOL_ADMIN])) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $school = $user->isSchoolAdmin() ? $user->primarySchool() : null;
        $schoolId = $school?->id;

        // Platform & School counts
        $totalSchools = School::where('is_active', true)->count();
        $totalSchoolAdmins = User::whereIn('role', ['admin', 'school_admin'])->count();

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

        // Top Performing Learners by XP
        $topLearnersQuery = User::where('role', 'learner')
            ->select(['id', 'name', 'email'])
            ->with([
                'learnerProfile.school:id,name',
                'gamification:id,user_id,total_xp,level,rank',
            ])
            ->whereHas('gamification', fn ($q) => $q->where('total_xp', '>', 0));

        if (!$isSuperAdmin && $schoolId) {
            $topLearnersQuery->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $schoolId));
        }

        $topLearners = $topLearnersQuery->get()
            ->sortByDesc(fn ($u) => $u->gamification?->total_xp ?? 0)
            ->take(5)
            ->values()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'school' => $u->learnerProfile?->school?->name ?? 'Primary School',
                'grade_level' => $u->learnerProfile?->grade_level ?? 'SS1',
                'total_xp' => $u->gamification?->total_xp ?? 0,
                'rank' => $u->gamification?->rank ?? 'Newcomer',
                'level' => $u->gamification?->level ?? 1,
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
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);

        $query = School::with(['admin:id,name,email'])
            ->withCount(['classes', 'learnerProfiles as learners_count']);

        // If School Admin, only return their assigned school
        if (!$isSuperAdmin) {
            $query->where('admin_user_id', $user->id);
        }

        $schools = $query->orderBy('name')->get();

        return response()->json(['schools' => $schools, 'data' => $schools]);
    }

    public function storeSchool(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
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

        $slug = !empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        $originalSlug = $slug;
        $count = 1;
        while (School::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $school = School::create([
            'name' => $validated['name'],
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

        $admins = User::whereIn('role', ['admin', 'school_admin', 'super_admin'])
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

    public function storeSchoolAdmin(Request $request): JsonResponse
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

        $user = User::where('id', $id)->whereIn('role', ['admin', 'school_admin', 'super_admin'])->firstOrFail();

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
    // Learners Management
    // ──────────────────────────────────────────────────────────────────────────

    public function getLearners(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $query = User::where('role', 'learner')
            ->with([
                'learnerProfile.school:id,name',
                'gamification:id,user_id,total_xp,level,rank',
                'classes:id,name,grade_level',
            ]);

        if (!$isSuperAdmin && $schoolId) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $schoolId));
        } elseif ($request->filled('school_id')) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $request->school_id));
        }

        if ($request->filled('grade_level')) {
            $query->whereHas('learnerProfile', fn ($q) => $q->where('grade_level', $request->grade_level));
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

    public function storeLearner(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'school_id' => 'nullable|exists:schools,id',
            'grade_level' => 'nullable|string|max:50',
            'student_id' => 'nullable|string|max:50',
            'class_id' => 'nullable|exists:classes,id',
        ]);

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
                'rank' => 'Newcomer',
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
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $query = Subject::withCount(['topics'])
            ->with([
                'school:id,name',
                'topics' => function ($q) {
                    $q->withCount('questions')->orderBy('sort_order');
                }
            ]);

        if (!$isSuperAdmin && $schoolId) {
            $query->where(function ($q) use ($schoolId) {
                $q->where('school_id', $schoolId)->orWhereNull('school_id');
            });
        }

        $subjects = $query->orderBy('sort_order')->get();

        return response()->json(['subjects' => $subjects]);
    }

    public function storeSubject(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subjects,slug',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'sort_order' => 'nullable|integer',
            'school_id' => 'nullable|exists:schools,id',
        ]);

        $slug = !empty($validated['slug']) ? Str::slug($validated['slug']) : Str::slug($validated['name']);
        // Ensure slug uniqueness
        $originalSlug = $slug;
        $count = 1;
        while (Subject::where('slug', $slug)->exists()) {
            $slug = "{$originalSlug}-{$count}";
            $count++;
        }

        $assignedSchoolId = $isSuperAdmin ? ($validated['school_id'] ?? null) : $schoolId;

        $subject = Subject::create([
            'school_id' => $assignedSchoolId,
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json([
            'message' => 'Subject created successfully',
            'subject' => $subject->load(['school:id,name'])->loadCount('topics'),
        ], 201);
    }

    public function updateSubject(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $subject = Subject::findOrFail($id);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255|unique:subjects,slug,' . $id,
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:active,inactive',
            'sort_order' => 'nullable|integer',
        ]);

        if (!empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['slug']);
        }

        $subject->update($validated);

        return response()->json([
            'message' => 'Subject updated successfully',
            'subject' => $subject->loadCount('topics'),
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
        $this->authorizeAdmin($request);

        $query = Topic::with('subject:id,name,slug')->withCount('questions');

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        $topics = $query->orderBy('sort_order')->get();

        return response()->json(['topics' => $topics]);
    }

    public function storeTopic(Request $request): JsonResponse
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

        $topic = Topic::create([
            'subject_id' => $validated['subject_id'],
            'name' => $validated['name'],
            'slug' => $slug,
            'level' => $validated['level'] ?? 'ss1',
            'description' => $validated['description'] ?? null,
            'status' => $validated['status'] ?? 'active',
            'sort_order' => $validated['sort_order'] ?? 0,
        ]);

        return response()->json([
            'message' => 'Topic created successfully',
            'topic' => $topic->load('subject:id,name,slug')->loadCount('questions'),
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
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

        $query = Question::with(['options', 'topic.subject:id,name,slug,school_id', 'school:id,name']);

        if (!$isSuperAdmin && $schoolId) {
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

    public function storeQuestion(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

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

    public function updateQuestion(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);
        $user = $request->user();
        $isSuperAdmin = in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN]);
        $schoolId = $user->isSchoolAdmin() ? $user->primarySchool()?->id : null;

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
        $this->authorizeAdmin($request);

        $question = Question::findOrFail($id);
        $question->delete();

        return response()->json(['message' => 'Question deleted successfully']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Class Cohorts & Roster Management
    // ──────────────────────────────────────────────────────────────────────────

    public function getClasses(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $user = $request->user();
        $isSchoolAdmin = $user && $user->isSchoolAdmin();
        $schoolId = $isSchoolAdmin ? $user->primarySchool()?->id : $request->school_id;

        $classes = ClassModel::with(['school:id,name'])
            ->withCount(['learnerUsers as learner_count'])
            ->when($schoolId, fn ($q) => $q->where('school_id', $schoolId))
            ->when($request->filled('grade_level'), fn ($q) => $q->where('grade_level', $request->grade_level))
            ->orderBy('name')
            ->get();

        return response()->json(['classes' => $classes]);
    }

    public function storeClass(Request $request): JsonResponse
    {
        $this->authorizeAdmin($request);

        $user = $request->user();
        $isSchoolAdmin = $user && $user->isSchoolAdmin();
        $schoolId = $isSchoolAdmin ? $user->primarySchool()?->id : null;

        $validated = $request->validate([
            'school_id' => $isSchoolAdmin ? 'nullable|exists:schools,id' : 'required|exists:schools,id',
            'name' => 'required|string|max:100',
            'grade_level' => 'required|string|in:JSS1,JSS2,JSS3,SS1,SS2,SS3',
            'section' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
        ]);

        $assignedSchoolId = $schoolId ?: $validated['school_id'];
        $slug = Str::slug($validated['name']) . '-' . Str::random(5);

        $class = ClassModel::create([
            'school_id' => $assignedSchoolId,
            'name' => $validated['name'],
            'slug' => $slug,
            'grade_level' => $validated['grade_level'],
            'section' => $validated['section'] ?? null,
            'description' => $validated['description'] ?? null,
            'is_active' => true,
        ]);

        return response()->json([
            'message' => 'Class created successfully',
            'class' => $class->load(['school:id,name'])->loadCount(['learnerUsers as learner_count']),
        ], 201);
    }

    public function updateClass(Request $request, int $id): JsonResponse
    {
        $this->authorizeAdmin($request);

        $class = ClassModel::findOrFail($id);

        $validated = $request->validate([
            'school_id' => 'nullable|exists:schools,id',
            'name' => 'required|string|max:100',
            'grade_level' => 'required|string|in:JSS1,JSS2,JSS3,SS1,SS2,SS3',
            'section' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        $class->update($validated);

        return response()->json([
            'message' => 'Class updated successfully',
            'class' => $class->fresh(['school:id,name'])->loadCount(['learnerUsers as learner_count']),
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

        $learners = DB::table('users as u')
            ->whereIn('u.id', $learnerIds)
            ->leftJoin('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->leftJoin(DB::raw('(
                SELECT user_id,
                       COUNT(*) as topics_covered,
                       AVG(mastery_score) as avg_mastery,
                       SUM(questions_attempted) as total_attempted,
                       SUM(questions_correct) as total_correct
                FROM learner_progress
                GROUP BY user_id
            ) as lp'), 'lp.user_id', '=', 'u.id')
            ->select([
                'u.id',
                'u.name',
                'u.email',
                DB::raw('COALESCE(ug.level, 1) as level'),
                DB::raw("COALESCE(ug.`rank`, 'Newcomer') as `rank`"),
                DB::raw('COALESCE(ug.total_xp, 0) as total_xp'),
                DB::raw('COALESCE(ug.current_streak, 0) as streak'),
                DB::raw('COALESCE(lp.topics_covered, 0) as topics_covered'),
                DB::raw('ROUND(COALESCE(lp.avg_mastery, 0)) as avg_mastery'),
                DB::raw('COALESCE(lp.total_attempted, 0) as total_attempted'),
                DB::raw('COALESCE(lp.total_correct, 0) as total_correct'),
            ])
            ->orderByDesc('total_xp')
            ->get();

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

        if ($learner->role !== UserRole::LEARNER) {
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
        $role = $user?->role?->value ?? $user?->role;
        if (!$user || !in_array($role, ['admin', 'super_admin', 'school_admin', 'teacher'])) {
            abort(403, 'Forbidden');
        }
    }

    private function authorizeSuperAdmin(Request $request): void
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, [UserRole::ADMIN, UserRole::SUPER_ADMIN])) {
            abort(403, 'Forbidden. Super Admin access required.');
        }
    }
}

