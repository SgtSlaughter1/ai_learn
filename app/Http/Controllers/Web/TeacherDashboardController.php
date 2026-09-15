<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\ClassMembership;
use App\Models\LearnerProgress;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TeacherDashboardController extends Controller
{
    /**
     * Render the teacher dashboard page.
     */
    public function index(Request $request): mixed
    {
        $user = $request->user();
        if (!$user || (!$user->isAdmin() && !$user->teacherProfile()->exists())) {
            abort(403);
        }

        // Get teacher's school
        $teacherProfile = $user->teacherProfile()->with('school')->first();
        $school = $teacherProfile?->school;

        if (!$school) {
            // Teacher without a school — show setup page
            return Inertia::render('teacher/Dashboard', [
                'school' => null,
                'classes' => [],
                'selectedClass' => null,
            ]);
        }

        $gradeOrder = [
            'CRECHE' => 1, 'KG1' => 2, 'KG2' => 3, 'NUR1' => 4, 'NUR2' => 5,
            'PRI1' => 6, 'PRI2' => 7, 'PRI3' => 8, 'PRI4' => 9, 'PRI5' => 10, 'PRI6' => 11,
            'JSS1' => 12, 'JSS2' => 13, 'JSS3' => 14, 'SS1' => 15, 'SS2' => 16, 'SS3' => 17,
        ];

        // Get teacher's classes
        $classes = ClassModel::where('school_id', $school->id)
            ->whereHas('memberships', fn ($q) => $q->where('user_id', $user->id)->where('role', 'teacher'))
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
        ]);
    }

    /**
     * Get aggregated stats for the teacher's classes.
     */
    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || (!$user->isAdmin() && !$user->teacherProfile()->exists())) {
            abort(403);
        }

        $teacherProfile = $user->teacherProfile()->first();
        $school = $teacherProfile?->school;

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

        // Get all class IDs this teacher teaches
        $classIds = ClassMembership::where('user_id', $user->id)
            ->where('role', 'teacher')
            ->pluck('class_id');

        $selectedClassId = $request->get('class_id');

        // Get learners in the selected class (or all classes) directly from indexed ClassMembership table
        $learnerIds = ClassMembership::where('role', 'learner')
            ->when($selectedClassId, fn ($q) => $q->where('class_id', $selectedClassId), fn ($q) => $q->whereIn('class_id', $classIds))
            ->pluck('user_id');

        // Overview stats
        $progressStats = LearnerProgress::whereIn('user_id', $learnerIds)
            ->selectRaw('COUNT(DISTINCT user_id) as total_learners, SUM(questions_attempted) as total_attempted, SUM(questions_correct) as total_correct, AVG(mastery_score) as avg_mastery')
            ->first();

        $quizStats = QuizAttempt::whereIn('user_id', $learnerIds)
            ->selectRaw('COUNT(*) as total_attempts, AVG(score) as avg_score, MAX(score) as best_score')
            ->where('status', 'completed')
            ->first();

        // Optimized: Sort and limit at database level instead of hydrating all models in PHP
        $topPerformers = DB::table('users as u')
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

        // Optimized: Direct SQL having filter instead of loading full collections into PHP
        $strugglingLearners = DB::table('users as u')
            ->join('learner_progress as lp', 'lp.user_id', '=', 'u.id')
            ->whereIn('u.id', $learnerIds)
            ->groupBy('u.id', 'u.name')
            ->havingRaw('AVG(lp.mastery_score) < 40')
            ->select([
                'u.id',
                'u.name',
                DB::raw('ROUND(AVG(lp.mastery_score)) as avg_mastery'),
            ])
            ->orderBy('avg_mastery')
            ->limit(10)
            ->get();

        return response()->json([
            'stats' => [
                'totalStudents' => (int) ($progressStats->total_learners ?? 0),
                'classAverageMastery' => round($progressStats->avg_mastery ?? 0),
                'activeStudents' => count($topPerformers),
            ],
            'recentActivities' => [],
            'overview' => [
                'total_learners' => (int) ($progressStats->total_learners ?? 0),
                'total_attempted' => (int) ($progressStats->total_attempted ?? 0),
                'total_correct' => (int) ($progressStats->total_correct ?? 0),
                'avg_mastery' => round($progressStats->avg_mastery ?? 0),
                'total_attempts' => (int) ($quizStats->total_attempts ?? 0),
                'avg_score' => round($quizStats->avg_score ?? 0),
                'best_score' => round($quizStats->best_score ?? 0),
            ],
            'top_performers' => $topPerformers,
            'struggling_learners' => $strugglingLearners,
            'classes' => ClassModel::where('school_id', $school->id)
                ->whereHas('memberships', fn ($q) => $q->where('user_id', $user->id)->where('role', 'teacher'))
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
                ]),
        ]);
    }

    /**
     * Get learners in a specific class with their performance data.
     */
    public function getClassLearners(Request $request, int $classId): JsonResponse
    {
        $user = $request->user();

        // Verify teacher has access to this class
        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $user->id)
            ->where('role', 'teacher')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Access denied'], 403);
        }

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
    public function createClass(Request $request): JsonResponse
    {
        $user = $request->user();
        $teacherProfile = $user->teacherProfile()->first();

        if (!$teacherProfile) {
            return response()->json(['error' => 'No school profile found'], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'grade_level' => 'nullable|string|max:50',
            'section' => 'nullable|string|max:50',
            'description' => 'nullable|string|max:500',
        ]);

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
     * Enroll a learner into a class.
     */
    public function enrollLearner(Request $request, int $classId): JsonResponse
    {
        $user = $request->user();

        // Verify teacher has access
        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $user->id)
            ->where('role', 'teacher')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        $validated = $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $learner = User::where('email', $validated['email'])->first();

        if (!$learner->isLearner()) {
            return response()->json(['error' => 'User is not a learner'], 400);
        }

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
            $class = ClassModel::find($classId);
            if (!$learner->learnerProfile()->where('school_id', $class->school_id)->exists()) {
                \App\Models\LearnerProfile::create([
                    'user_id' => $learner->id,
                    'school_id' => $class->school_id,
                    'grade_level' => $class->grade_level,
                ]);
            }
        }

        return response()->json(['message' => 'Learner enrolled successfully']);
    }

    /**
     * Remove a learner from a class.
     */
    public function removeLearner(Request $request, int $classId, int $learnerId): JsonResponse
    {
        $user = $request->user();

        $membership = ClassMembership::where('class_id', $classId)
            ->where('user_id', $user->id)
            ->where('role', 'teacher')
            ->first();

        if (!$membership) {
            return response()->json(['error' => 'Access denied'], 403);
        }

        ClassMembership::where('class_id', $classId)
            ->where('user_id', $learnerId)
            ->where('role', 'learner')
            ->update(['is_active' => false]);

        return response()->json(['message' => 'Learner removed from class']);
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
}
