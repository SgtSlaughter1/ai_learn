<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Render the centralized School/Super Administrator management portal.
     */
    public function show(Request $request): Response
    {
        return Inertia::render('admin/Dashboard');
    }

    /**
     * Retrieve aggregated platform and school performance statistics.
     * Cached on backend for 5 minutes.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        // Platform admins see the whole platform; school admins their own school.
        if ($user->can('manage-platform')) {
            if ($request->boolean('refresh')) {
                Cache::forget('analytics:admin:platform');
            }
            $stats = Cache::remember('analytics:admin:platform', now()->addMinutes(5), function () use ($user) {
                return $this->getPlatformAdminStats($user);
            });

            return response()->json($stats);
        }

        $school = $user->primarySchool();
        $schoolId = $school?->id ?? 'unknown';
        if ($request->boolean('refresh')) {
            Cache::forget("analytics:admin:school:{$schoolId}");
        }
        $stats = Cache::remember("analytics:admin:school:{$schoolId}", now()->addMinutes(5), function () use ($user) {
            return $this->getSchoolAdminStats($user);
        });

        return response()->json($stats);
    }

    /**
     * Compile statistics for Platform / Super Administrators (platform-wide).
     */
    private function getPlatformAdminStats(User $user): array
    {
        $totalSchools = School::where('is_active', true)->count();
        $totalSchoolAdmins = User::where('role', 'school_admin')->count();
        $totalTeachers = User::where('role', 'teacher')->count();
        $totalLearners = User::where('role', 'learner')->count();
        $totalClasses = ClassModel::where('is_active', true)->count();

        $totalSubjects = Subject::where('status', 'active')->count();
        $totalTopics = Topic::where('status', 'active')->count();
        $totalQuizzes = Quiz::where('status', 'active')->count();
        $totalQuestions = Question::where('status', 'active')->count();

        $progressAggregates = LearnerProgress::selectRaw('
            SUM(questions_attempted) as total_answered,
            SUM(questions_correct) as total_correct,
            AVG(mastery_score) as avg_mastery
        ')->first();

        $totalQuestionsAnswered = (int) ($progressAggregates?->total_answered ?? 0);
        $avgMastery = (int) round($progressAggregates?->avg_mastery ?? 0);
        $totalAttempts = QuizAttempt::where('status', 'completed')->count();

        $gradeDistribution = LearnerProfile::whereNotNull('grade_level')
            ->selectRaw('grade_level, count(*) as count')
            ->groupBy('grade_level')
            ->pluck('count', 'grade_level')
            ->toArray();

        $topLearners = DB::table('users as u')
            ->join('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->leftJoin('learner_profiles as lp', 'lp.user_id', '=', 'u.id')
            ->leftJoin('schools as s', 's.id', '=', 'lp.school_id')
            ->where('u.role', 'learner')
            ->where('ug.total_xp', '>', 0)
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

        $strugglingLearners = DB::table('users as u')
            ->join('learner_progress as lp', 'lp.user_id', '=', 'u.id')
            ->leftJoin('learner_profiles as lprof', 'lprof.user_id', '=', 'u.id')
            ->leftJoin('schools as s', 's.id', '=', 'lprof.school_id')
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

        $allowedGradeLevels = School::allowedGradeLevelsForCategory(null);
        $gradeOptions = School::gradeOptionsForCategory(null);

        return [
            'is_super_admin' => true,
            'role' => $user->role?->value ?? $user->role,
            'school' => null,
            'allowed_grade_levels' => $allowedGradeLevels,
            'grade_options' => $gradeOptions,
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
            'top_learners' => $topLearners->values()->all(),
            'struggling_learners' => $strugglingLearners->values()->all(),
            'grade_distribution' => $gradeDistribution,
        ];
    }

    /**
     * Compile statistics for School Administrators (scoped to assigned school).
     */
    private function getSchoolAdminStats(User $user): array
    {
        $school = $user->primarySchool();
        $schoolId = $school?->id;

        $totalSchools = $schoolId ? School::where('id', $schoolId)->where('is_active', true)->count() : 0;
        $totalSchoolAdmins = 1;

        $totalTeachers = $schoolId ? User::where('role', 'teacher')
            ->whereHas('teacherProfile', fn ($q) => $q->where('school_id', $schoolId))
            ->count() : 0;

        $totalLearners = $schoolId ? User::where('role', 'learner')
            ->whereHas('learnerProfile', fn ($q) => $q->where('school_id', $schoolId))
            ->count() : 0;

        $totalClasses = $schoolId ? ClassModel::where('is_active', true)
            ->where('school_id', $schoolId)
            ->count() : 0;

        $totalSubjects = Subject::where('status', 'active')->count();
        $totalTopics = Topic::where('status', 'active')->count();
        $totalQuizzes = Quiz::where('status', 'active')->count();
        $totalQuestions = Question::where('status', 'active')->count();

        $progressAggregates = $schoolId ? LearnerProgress::whereHas('user.learnerProfile', fn ($q) => $q->where('school_id', $schoolId))
            ->selectRaw('
                SUM(questions_attempted) as total_answered,
                SUM(questions_correct) as total_correct,
                AVG(mastery_score) as avg_mastery
            ')->first() : null;

        $totalQuestionsAnswered = (int) ($progressAggregates?->total_answered ?? 0);
        $avgMastery = (int) round($progressAggregates?->avg_mastery ?? 0);

        $totalAttempts = $schoolId ? QuizAttempt::where('status', 'completed')
            ->whereHas('user.learnerProfile', fn ($q) => $q->where('school_id', $schoolId))
            ->count() : 0;

        $gradeDistribution = $schoolId ? LearnerProfile::whereNotNull('grade_level')
            ->where('school_id', $schoolId)
            ->selectRaw('grade_level, count(*) as count')
            ->groupBy('grade_level')
            ->pluck('count', 'grade_level')
            ->toArray() : [];

        $topLearnersQuery = DB::table('users as u')
            ->join('user_gamification as ug', 'ug.user_id', '=', 'u.id')
            ->join('learner_profiles as lp', 'lp.user_id', '=', 'u.id')
            ->leftJoin('schools as s', 's.id', '=', 'lp.school_id')
            ->where('u.role', 'learner')
            ->where('ug.total_xp', '>', 0);

        if ($schoolId) {
            $topLearnersQuery->where('lp.school_id', $schoolId);
        }

        $topLearners = $topLearnersQuery
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

        $strugglingQuery = DB::table('users as u')
            ->join('learner_progress as lp', 'lp.user_id', '=', 'u.id')
            ->join('learner_profiles as lprof', 'lprof.user_id', '=', 'u.id')
            ->leftJoin('schools as s', 's.id', '=', 'lprof.school_id');

        if ($schoolId) {
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

        $allowedGradeLevels = $school ? ($school->allowed_grade_levels ?? []) : School::allowedGradeLevelsForCategory(null);
        $gradeOptions = $school ? ($school->grade_options ?? []) : School::gradeOptionsForCategory(null);

        return [
            'is_super_admin' => false,
            'role' => $user->role?->value ?? $user->role,
            'school' => $school ? [
                'id' => $school->id,
                'name' => $school->name,
                'slug' => $school->slug,
                'category' => $school->category,
                'category_ids' => $school->category_ids ?? [],
                'allowed_grade_levels' => $allowedGradeLevels,
                'grade_options' => $gradeOptions,
            ] : null,
            'allowed_grade_levels' => $allowedGradeLevels,
            'grade_options' => $gradeOptions,
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
            'top_learners' => $topLearners->values()->all(),
            'struggling_learners' => $strugglingLearners->values()->all(),
            'grade_distribution' => $gradeDistribution,
        ];
    }
}
