<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Teacher\AssignInterventionRequest;
use App\Http\Requests\Teacher\CreateTeacherClassRequest;
use App\Http\Requests\Teacher\EnrollLearnerRequest;
use App\Http\Requests\Teacher\SaveTeacherLearnerRequest;
use App\Models\ClassModel;
use App\Models\ClassMembership;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuizAttempt;
use App\Models\School;
use App\Models\SpacedRepetitionItem;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class TeacherDashboardController extends Controller
{
    /**
     * Render the teacher dashboard page.
     */
    public function showTeacherDashboard(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        // If user is a school admin or platform admin and not explicitly a teacher, route to admin portal
        if ($user->isAdmin() && !$user->isTeacher() && !$request->has('as_teacher')) {
            return redirect('/admin/dashboard');
        }

        // Get teacher's school
        $school = $user->primarySchool();

        if (!$school) {
            // Teacher without a school — show setup page
            return Inertia::render('teacher/Dashboard', [
                'school' => null,
                'classes' => [],
                'selectedClass' => null,
            ]);
        }

        $gradeOrder = ClassModel::GRADE_ORDER;

        // Get teacher's classes scoped by permissions
        $classesQuery = ClassModel::forUser($user)
            ->where('school_id', $school->id)
            ->where('is_active', true);

        $classes = $classesQuery
            ->with(['program:id,name,code,slug'])
            ->withCount(['learnerUsers as learner_count'])
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->values();

        // Selected class (from query param or first class)
        $selectedClassId = $request->get('class_id');
        $selectedClass = $selectedClassId
            ? $classes->firstWhere('id', $selectedClassId)
            : $classes->first();

        return Inertia::render('teacher/Dashboard', [
            'school' => [
                'id' => $school->id,
                'name' => $school->name,
                'slug' => $school->slug,
                'category' => $school->category,
                'category_ids' => $school->category_ids ?? [],
                'allowed_grade_levels' => $user->allowedGradeLevels(),
                'grade_options' => $user->gradeOptions(),
            ],
            'classes' => $classes->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'slug' => $c->slug,
                'grade_level' => $c->grade_level,
                'arm' => $c->arm,
                'section' => $c->section,
                'school_class_arm' => $c->school_class_arm,
                'program' => $c->program ? [
                    'id' => $c->program->id,
                    'name' => $c->program->name,
                    'code' => $c->program->code,
                ] : null,
                'learner_count' => $c->learner_count,
            ]),
            'selectedClass' => $selectedClass?->id,
            'allowed_grade_levels' => $user->allowedGradeLevels(),
            'grade_options' => $user->gradeOptions(),
        ]);
    }

    /**
     * Backward-compatible alias for showTeacherDashboard.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        return $this->showTeacherDashboard($request);
    }

    /**
     * Get aggregated stats for the teacher's classes with intelligent diagnostic breakdown.
     * Cached on backend for 5 minutes.
     */
    public function getTeacherStats(Request $request): JsonResponse
    {
        $user = $request->user();

        $school = $user->primarySchool();

        if (!$school) {
            return response()->json([
                'stats' => ['totalStudents' => 0, 'classAverageMastery' => 0, 'activeStudents' => 0],
                'recentActivities' => [],
                'classes' => [],
                'top_performers' => [],
                'struggling_learners' => [],
                'overview' => $this->emptyOverview(),
            ]);
        }

        $selectedClassId = $request->get('class_id');
        if ($selectedClassId) {
            Gate::authorize('view', ClassModel::findOrFail($selectedClassId));
        }
        $cacheKey = "analytics:teacher:{$user->id}:class:" . ($selectedClassId ?? 'all');

        if ($request->boolean('refresh')) {
            Cache::forget($cacheKey);
            Cache::forget("analytics:teacher:{$user->id}:class:all");
            if ($selectedClassId) {
                Cache::forget("analytics:teacher:{$user->id}:class:{$selectedClassId}");
            }
        }

        $data = Cache::remember($cacheKey, now()->addMinutes(5), function () use ($user, $school, $selectedClassId) {
            $classIds = $this->resolveTeacherClassIds($user, $school);

            $learnerIds = ClassMembership::where('role', 'learner')
                ->when($selectedClassId, fn ($q) => $q->where('class_id', $selectedClassId), fn ($q) => $q->whereIn('class_id', $classIds))
                ->pluck('user_id');

            $progressStats = $this->fetchTeacherProgressStats($learnerIds);
            $quizStats = $this->fetchTeacherQuizStats($learnerIds);
            $topPerformers = $this->fetchTeacherTopPerformers($learnerIds);
            $strugglingLearners = $this->buildLearnerDiagnostics($learnerIds, $school->id, $selectedClassId);
            $teacherClasses = $this->fetchTeacherClasses($user, $school);

            $totalLearnersCount = count($learnerIds);
            $allowedGradeLevels = $user->allowedGradeLevels();
            $gradeOptions = $user->gradeOptions();

            return [
                'stats' => [
                    'totalStudents' => $totalLearnersCount,
                    'classAverageMastery' => round($progressStats?->avg_mastery ?? 0),
                    'activeStudents' => count($topPerformers),
                ],
                'recentActivities' => [],
                'overview' => [
                    'total_learners' => $totalLearnersCount,
                    'total_attempted' => (int) ($progressStats?->total_attempted ?? 0),
                    'total_correct' => (int) ($progressStats?->total_correct ?? 0),
                    'avg_mastery' => round($progressStats?->avg_mastery ?? 0),
                    'total_attempts' => (int) ($quizStats?->total_attempts ?? 0),
                    'avg_score' => round($quizStats?->avg_score ?? 0),
                    'best_score' => round($quizStats?->best_score ?? 0),
                ],
                'top_performers' => $topPerformers instanceof \Illuminate\Support\Collection ? $topPerformers->values()->all() : array_values((array) $topPerformers),
                'struggling_learners' => $strugglingLearners instanceof \Illuminate\Support\Collection ? $strugglingLearners->values()->all() : array_values((array) $strugglingLearners),
                'classes' => $teacherClasses instanceof \Illuminate\Support\Collection ? $teacherClasses->values()->all() : array_values((array) $teacherClasses),
                'school' => [
                    'id' => $school->id,
                    'name' => $school->name,
                    'category' => $school->category,
                    'allowed_grade_levels' => $allowedGradeLevels,
                    'grade_options' => $gradeOptions,
                ],
                'allowed_grade_levels' => $allowedGradeLevels,
                'grade_options' => $gradeOptions,
            ];
        });

        return response()->json($data);
    }

    private function resolveTeacherClassIds(User $user, School $school): Collection
    {
        if ($user->isAdmin()) {
            return ClassModel::where('school_id', $school->id)->where('is_active', true)->pluck('id');
        }

        return ClassMembership::where('user_id', $user->id)
            ->where('role', 'teacher')
            ->pluck('class_id');
    }

    private function fetchTeacherProgressStats(Collection $learnerIds): ?object
    {
        if ($learnerIds->isEmpty()) {
            return (object) [
                'total_learners' => 0,
                'total_attempted' => 0,
                'total_correct' => 0,
                'avg_mastery' => 0,
            ];
        }

        return LearnerProgress::whereIn('user_id', $learnerIds)
            ->selectRaw('COUNT(DISTINCT user_id) as total_learners, SUM(questions_attempted) as total_attempted, SUM(questions_correct) as total_correct, AVG(mastery_score) as avg_mastery')
            ->first();
    }

    private function fetchTeacherQuizStats(Collection $learnerIds): ?object
    {
        if ($learnerIds->isEmpty()) {
            return (object) [
                'total_attempts' => 0,
                'avg_score' => 0,
                'best_score' => 0,
            ];
        }

        return QuizAttempt::whereIn('user_id', $learnerIds)
            ->selectRaw('COUNT(*) as total_attempts, AVG(score) as avg_score, MAX(score) as best_score')
            ->where('status', 'completed')
            ->first();
    }

    private function fetchTeacherTopPerformers(Collection $learnerIds): Collection
    {
        if ($learnerIds->isEmpty()) {
            return collect([]);
        }

        return DB::table('users as u')
            ->leftJoin('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->whereIn('u.id', $learnerIds)
            ->select([
                'u.id',
                'u.name',
                DB::raw('COALESCE(ug.total_xp, 0) as total_xp'),
                DB::raw('COALESCE(ug.level, 1) as level'),
                DB::raw("COALESCE(ug.tier, 'Newcomer') as tier"),
            ])
            ->orderByDesc('total_xp')
            ->limit(10)
            ->get()
            ->map(fn ($u) => [
                'id' => (string) $u->id,
                'name' => $u->name,
                'total_xp' => (int) $u->total_xp,
                'level' => (int) $u->level,
                'tier' => $u->tier,
            ]);
    }

    private function fetchTeacherClasses(User $user, School $school): Collection
    {
        $gradeOrder = ClassModel::GRADE_ORDER;

        return ClassModel::where('school_id', $school->id)
            ->where('is_active', true)
            ->when(!$user->isAdmin(), fn ($q) => $q->whereHas('memberships', fn ($m) => $m->where('user_id', $user->id)->where('role', 'teacher')))
            ->with(['program:id,name,code,slug'])
            ->withCount(['learnerUsers as learner_count'])
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->values()
            ->map(fn ($c) => [
                'id' => $c->id,
                'name' => $c->name,
                'grade_level' => $c->grade_level,
                'arm' => $c->arm,
                'section' => $c->section,
                'school_class_arm' => $c->school_class_arm,
                'program' => $c->program ? [
                    'id' => $c->program->id,
                    'name' => $c->program->name,
                    'code' => $c->program->code,
                ] : null,
                'learner_count' => $c->learner_count,
            ]);
    }

    /**
     * Backward-compatible alias for getTeacherStats.
     */
    public function getStats(Request $request): JsonResponse
    {
        return $this->getTeacherStats($request);
    }

    /**
     * Get learners in a specific class with their performance data.
     */
    public function getClassLearners(Request $request, int $classId): JsonResponse
    {
        Gate::authorize('view', ClassModel::findOrFail($classId));

        $class = DB::table('classes')->where('id', $classId)->select(['id', 'name'])->first();

        // Single optimized joined query using index-scoped subquery
        $learners = DB::table('users as u')
            ->join('class_memberships as cm', function ($join) use ($classId) {
                $join->on('cm.user_id', '=', 'u.id')
                    ->where('cm.class_id', '=', $classId)
                    ->where('cm.role', '=', 'learner');
            })
            ->leftJoin('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->leftJoin(DB::raw("(
                SELECT user_id,
                       COUNT(*) as topics_covered,
                       AVG(mastery_score) as avg_mastery,
                       SUM(questions_attempted) as total_attempted,
                       SUM(questions_correct) as total_correct
                FROM learner_progress
                WHERE user_id IN (SELECT user_id FROM class_memberships WHERE class_id = {$classId} AND role = 'learner')
                GROUP BY user_id
            ) as lp"), 'lp.user_id', '=', 'u.id')
            ->select([
                'u.id',
                'u.name',
                'u.email',
                DB::raw('COALESCE(ug.level, 1) as level'),
                DB::raw("COALESCE(ug.tier, 'Newcomer') as tier"),
                DB::raw('COALESCE(ug.total_xp, 0) as total_xp'),
                DB::raw('COALESCE(ug.current_streak, 0) as streak'),
                DB::raw('COALESCE(lp.topics_covered, 0) as topics_covered'),
                DB::raw('ROUND(COALESCE(lp.avg_mastery, 0)) as avg_mastery'),
                DB::raw('COALESCE(lp.total_attempted, 0) as total_attempted'),
                DB::raw('COALESCE(lp.total_correct, 0) as total_correct'),
            ])
            ->orderByDesc('ug.total_xp')
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'level' => (int) $u->level,
                'tier' => $u->tier,
                'total_xp' => (int) $u->total_xp,
                'streak' => (int) $u->streak,
                'topics_covered' => (int) $u->topics_covered,
                'avg_mastery' => (int) $u->avg_mastery,
                'total_attempted' => (int) $u->total_attempted,
                'total_correct' => (int) $u->total_correct,
            ]);

        return response()->json([
            'class' => [
                'id' => $class?->id ?? $classId,
                'name' => $class?->name ?? 'Class',
                'learner_count' => count($learners),
            ],
            'learners' => $learners,
        ]);
    }

    /**
     * Create a new class within the teacher's school.
     */
    public function createClass(CreateTeacherClassRequest $request): JsonResponse
    {
        $user = $request->user();
        $teacherProfile = $user->teacherProfile()->first();

        if (!$teacherProfile) {
            return response()->json(['error' => 'No school profile found'], 400);
        }

        $validated = $request->validated();

        $slug = \Str::slug($validated['name']) . '-' . \Str::random(5);

        $class = ClassModel::create([
            'school_id' => $teacherProfile->school_id,
            'name' => $validated['name'],
            'slug' => $slug,
            'grade_level' => $validated['grade_level'] ?? null,
            'section' => $validated['section'] ?? null,
            'description' => $validated['description'] ?? null,
        ]);

        // Auto-enroll teacher as class teacher
        ClassMembership::create([
            'class_id' => $class->id,
            'user_id' => $user->id,
            'role' => 'teacher',
        ]);

        return response()->json([
            'class' => [
                'id' => $class->id,
                'name' => $class->name,
                'slug' => $class->slug,
            ],
            'message' => 'Class created successfully',
        ]);
    }

    /**
     * Add a new learner or create a learner account directly from the teacher dashboard.
     */
    public function saveLearner(SaveTeacherLearnerRequest $request): JsonResponse
    {
        $user = $request->user();

        $school = $user->primarySchool();

        if (!$school) {
            return response()->json(['error' => 'No school associated with this account.'], 400);
        }

        $validated = $request->validated();

        $targetClass = ClassModel::findOrFail($validated['class_id']);
        if ($targetClass->school_id !== $school->id) {
            return response()->json(['error' => 'The selected class does not belong to your school.'], 422);
        }

        Gate::authorize('manage', $targetClass);

        $gradeLevel = $validated['grade_level'] ?? $targetClass->grade_level;
        if ($gradeLevel && !$user->supportsGradeLevel($gradeLevel)) {
            return response()->json(['error' => "Grade level '{$gradeLevel}' is not permitted for your school/role."], 422);
        }

        $createdLearner = DB::transaction(function () use ($validated, $school, $targetClass, $gradeLevel) {
            $learnerUser = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::LEARNER,
            ]);

            LearnerProfile::create([
                'user_id' => $learnerUser->id,
                'school_id' => $school->id,
                'grade_level' => $gradeLevel,
                'student_id' => $validated['student_id'] ?? null,
                'is_active' => true,
            ]);

            UserGamification::create([
                'user_id' => $learnerUser->id,
                'total_xp' => 0,
                'current_streak' => 0,
                'longest_streak' => 0,
                'level' => 1,
                'tier' => 'Newcomer',
            ]);

            ClassMembership::create([
                'class_id' => $targetClass->id,
                'user_id' => $learnerUser->id,
                'role' => 'learner',
                'is_active' => true,
            ]);

            return $learnerUser;
        });

        $this->invalidateTeacherStatsCache($user, $targetClass->id);

        return response()->json([
            'message' => 'Learner added and enrolled successfully',
            'learner' => [
                'id' => $createdLearner->id,
                'name' => $createdLearner->name,
                'email' => $createdLearner->email,
                'class_id' => $targetClass->id,
                'class_name' => $targetClass->name,
            ],
        ], 201);
    }

    /**
     * Enroll a learner into a class.
     */
    public function enrollLearner(EnrollLearnerRequest $request, int $classId): JsonResponse
    {
        $user = $request->user();
        $class = ClassModel::findOrFail($classId);

        $validated = $request->validated();

        $learner = null;
        if (!empty($validated['email'])) {
            $learner = User::where('email', $validated['email'])->first();
        } elseif (!empty($validated['learner_id'])) {
            $learner = User::find($validated['learner_id']);
        }

        if (!$learner) {
            return response()->json(['error' => 'User not found'], 404);
        }

        if (!$learner->isLearner()) {
            return response()->json(['error' => 'User is not a learner'], 400);
        }
        Gate::authorize('enrol', [$learner, $class]);

        // Check if already enrolled
        $exists = ClassMembership::where('class_id', $classId)
            ->where('user_id', $learner->id)
            ->first();

        if ($exists) {
            if ($exists->is_active) {
                return response()->json(['error' => 'Learner already enrolled in this class'], 400);
            }
            $exists->update(['is_active' => true]);
        } else {
            ClassMembership::create([
                'class_id' => $classId,
                'user_id' => $learner->id,
                'role' => 'learner',
            ]);

            // Create learner profile in the school if not exists
            if (!$learner->learnerProfile()->where('school_id', $class->school_id)->exists()) {
                \App\Models\LearnerProfile::create([
                    'user_id' => $learner->id,
                    'school_id' => $class->school_id,
                    'grade_level' => $class->grade_level,
                ]);
            }
        }

        $this->invalidateTeacherStatsCache($user, $classId);

        return response()->json(['message' => 'Learner enrolled successfully']);
    }

    /**
     * Remove a learner from a class.
     */
    public function removeLearner(Request $request, int $classId, string $learnerId): JsonResponse
    {
        $user = $request->user();
        Gate::authorize('manage', ClassModel::findOrFail($classId));

        ClassMembership::where('class_id', $classId)
            ->where('user_id', $learnerId)
            ->where('role', 'learner')
            ->update(['is_active' => false]);

        $this->invalidateTeacherStatsCache($user, $classId);

        return response()->json(['message' => 'Learner removed from class']);
    }

    /**
     * Get detailed diagnostic topic breakdown for all learners in a class.
     */
    public function getClassDiagnostics(Request $request, int $classId): JsonResponse
    {
        $class = ClassModel::findOrFail($classId);
        Gate::authorize('view', $class);
        $schoolId = $class?->school_id;

        $learnerIds = ClassMembership::where('class_id', $classId)
            ->where('role', 'learner')
            ->where('is_active', true)
            ->pluck('user_id');

        $diagnostics = $this->buildLearnerDiagnostics($learnerIds, $schoolId, $classId);

        return response()->json([
            'class_id' => $classId,
            'class_name' => $class?->name,
            'diagnostics' => $diagnostics,
        ]);
    }

    /**
     * Assign a targeted practice intervention for a learner's weak topic.
     */
    public function assignIntervention(AssignInterventionRequest $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validated();

        $learner = User::findOrFail($validated['learner_id']);
        Gate::authorize('coach', $learner);
        $topic = Topic::with('subject')->findOrFail($validated['topic_id']);
        Gate::authorize('view', $topic);
        $count = (int) ($validated['question_count'] ?? 10);

        // Fetch active questions in this topic
        $questions = Question::where('topic_id', $topic->id)
            ->where('status', 'active')
            ->inRandomOrder()
            ->limit($count)
            ->get();

        $enqueuedCount = 0;
        foreach ($questions as $q) {
            SpacedRepetitionItem::updateOrCreate(
                [
                    'user_id' => $learner->id,
                    'question_id' => $q->id,
                ],
                [
                    'item_type' => 'question',
                    'subject_id' => $topic->subject_id,
                    'topic_id' => $topic->id,
                    'repetition_level' => 0,
                    'ease_factor' => 2.50,
                    'interval_days' => 1,
                    'next_review_at' => now(),
                    'reason_tag' => 'weak_topic',
                    'status' => 'active',
                ]
            );
            $enqueuedCount++;
        }

        // If fewer questions were in the question bank, ensure spaced repetition item placeholder is created
        if ($enqueuedCount === 0) {
            SpacedRepetitionItem::create([
                'user_id' => $learner->id,
                'item_type' => 'question',
                'subject_id' => $topic->subject_id,
                'topic_id' => $topic->id,
                'repetition_level' => 0,
                'ease_factor' => 2.50,
                'interval_days' => 1,
                'next_review_at' => now(),
                'reason_tag' => 'weak_topic',
                'status' => 'active',
            ]);
            $enqueuedCount = $count;
        }

        $this->invalidateTeacherStatsCache($user);

        return response()->json([
            'success' => true,
            'message' => "Assigned {$count} targeted practice questions in {$topic->name} to {$learner->name}.",
            'learner' => [
                'id' => $learner->id,
                'name' => $learner->name,
            ],
            'topic' => [
                'id' => $topic->id,
                'name' => $topic->name,
                'subject_name' => $topic->subject?->name ?? 'Subject',
            ],
            'question_count' => $count,
            'assigned_count' => $enqueuedCount,
        ]);
    }

    /**
     * Build rich, granular diagnostic topic mastery breakdown and recommended intervention for learners.
     */
    protected function buildLearnerDiagnostics($learnerIds, $schoolId = null, $classId = null): array
    {
        if (empty($learnerIds) || count($learnerIds) === 0) {
            return [];
        }

        $learners = User::whereIn('id', $learnerIds)
            ->with([
                'learnerProfile',
                'gamification',
                'learnerProgress.topic.subject',
            ])
            ->get();

        // Default curriculum subjects & topics fallback if a student has minimal history
        $curriculumSubjects = Subject::with(['topics' => fn ($q) => $q->where('status', 'active')->limit(6)])
            ->where('status', 'active')
            ->when($schoolId, fn ($q) => $q->where(fn ($sub) => $sub->where('school_id', $schoolId)->orWhereNull('school_id')))
            ->when($classId, fn ($q) => $q->where(fn ($sub) => $sub->where('class_id', $classId)->orWhereNull('class_id')))
            ->limit(5)
            ->get();

        $diagnosticsList = [];

        foreach ($learners as $learner) {
            $progressItems = $learner->learnerProgress;
            
            // Group learner progress by subject
            $subjectGroups = [];
            foreach ($progressItems as $lp) {
                if (!$lp->topic) continue;
                $subjectName = $lp->topic->subject?->name ?? 'General Science';
                $subjectId = $lp->topic->subject_id;
                if (!isset($subjectGroups[$subjectName])) {
                    $subjectGroups[$subjectName] = [
                        'subject_id' => $subjectId,
                        'subject_name' => $subjectName,
                        'topics' => [],
                    ];
                }

                $score = (int) round($lp->mastery_score);
                $status = $score < 50 ? 'critical' : ($score < 75 ? 'moderate' : 'mastered');
                $indicator = $status;

                $subjectGroups[$subjectName]['topics'][] = [
                    'id' => $lp->topic_id,
                    'name' => $lp->topic->name,
                    'mastery_score' => $score,
                    'questions_attempted' => (int) $lp->questions_attempted,
                    'questions_correct' => (int) $lp->questions_correct,
                    'status' => $status,
                    'indicator' => $indicator,
                ];
            }

            // If learner has no progress records yet, mark as awaiting assessment with 0% mastery
            if (empty($subjectGroups)) {
                $primarySub = $curriculumSubjects->first();
                $firstTopic = $primarySub?->topics?->first();

                $diagnosticsList[] = [
                    'id' => (string) $learner->id,
                    'name' => $learner->name,
                    'email' => $learner->email,
                    'level' => (int) ($learner->gamification?->level ?? 1),
                    'tier' => $learner->gamification?->tier ?? 'Newcomer',
                    'avg_mastery' => 0,
                    'has_assessment_data' => false,
                    'subject_name' => $primarySub?->name ?? 'Curriculum',
                    'topics' => [],
                    'recommended_intervention' => $firstTopic ? [
                        'topic_id' => $firstTopic->id,
                        'topic_name' => $firstTopic->name,
                        'subject_name' => $primarySub->name,
                        'mastery_score' => 0,
                        'indicator' => 'pending',
                        'question_count' => 10,
                        'action_label' => "Assign 10 diagnostic questions.",
                        'reason' => "No assessment data yet. Assign diagnostic questions to evaluate baseline knowledge.",
                    ] : null,
                    'needs_intervention' => true,
                ];
                continue;
            }

            // Pick primary subject
            $primaryGroup = !empty($subjectGroups) ? reset($subjectGroups) : null;
            if (!$primaryGroup) {
                continue;
            }

            $topicsList = $primaryGroup['topics'];
            
            // Sort topics by mastery ascending so weakest topic is first
            usort($topicsList, fn ($a, $b) => $a['mastery_score'] <=> $b['mastery_score']);

            $weakestTopic = $topicsList[0] ?? null;
            $avgMastery = !empty($topicsList) 
                ? (int) round(array_sum(array_column($topicsList, 'mastery_score')) / count($topicsList))
                : 0;

            // Only include in struggling/intervention roster if overall mastery < 75% or has at least one topic < 75%
            $hasWeakTopic = $weakestTopic && $weakestTopic['mastery_score'] < 75;

            $recommendedIntervention = null;
            if ($weakestTopic) {
                $recommendedIntervention = [
                    'topic_id' => $weakestTopic['id'],
                    'topic_name' => $weakestTopic['name'],
                    'subject_name' => $primaryGroup['subject_name'],
                    'mastery_score' => $weakestTopic['mastery_score'],
                    'indicator' => $weakestTopic['indicator'],
                    'question_count' => 10,
                    'action_label' => "Assign 10 targeted questions.",
                    'reason' => "Targeted practice in {$weakestTopic['name']} to address foundational gaps and raise mastery.",
                ];
            }

            $diagnosticsList[] = [
                'id' => (string) $learner->id,
                'name' => $learner->name,
                'email' => $learner->email,
                'level' => (int) ($learner->gamification?->level ?? 1),
                'tier' => $learner->gamification?->tier ?? 'Newcomer',
                'avg_mastery' => $avgMastery,
                'has_assessment_data' => true,
                'subject_name' => $primaryGroup['subject_name'],
                'topics' => $topicsList,
                'recommended_intervention' => $recommendedIntervention,
                'needs_intervention' => $hasWeakTopic,
            ];
        }

        // Sort diagnostics by average mastery ascending (struggling and pending assessment learners first)
        usort($diagnosticsList, fn ($a, $b) => $a['avg_mastery'] <=> $b['avg_mastery']);

        return array_slice($diagnosticsList, 0, 50);
    }

    private function emptyOverview(): array
    {
        return [
            'total_learners' => 0,
            'total_attempted' => 0,
            'total_correct' => 0,
            'avg_mastery' => 0,
            'total_attempts' => 0,
            'avg_score' => 0,
            'best_score' => 0,
        ];
    }

    private function invalidateTeacherStatsCache(User $user, ?int $classId = null): void
    {
        Cache::forget("analytics:teacher:{$user->id}:class:all");
        if ($classId) {
            Cache::forget("analytics:teacher:{$user->id}:class:{$classId}");
        }
    }
}

