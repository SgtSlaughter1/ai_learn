<?php

namespace App\Http\Controllers\Web;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\School;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    public function getStats(Request $request): JsonResponse
    {
        if ($request->user()?->role !== UserRole::ADMIN) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Platform-wide counts
        $totalSchools = School::where('is_active', true)->count();
        $totalTeachers = User::where('role', 'teacher')->count();
        $totalLearners = User::where('role', 'learner')->count();
        $totalClasses = ClassModel::where('is_active', true)->count();
        $totalSubjects = Subject::where('status', 'active')->count();
        $totalQuizzes = Quiz::where('status', 'active')->count();

        // Activity stats (single query on learner_progress)
        $totalAttempts = QuizAttempt::where('status', 'completed')->count();
        $progressAggregates = LearnerProgress::selectRaw('
            SUM(questions_attempted) as total_answered,
            SUM(questions_correct) as total_correct,
            AVG(mastery_score) as avg_mastery
        ')->first();

        $totalQuestionsAnswered = (int) ($progressAggregates?->total_answered ?? 0);
        $avgMastery = (int) round($progressAggregates?->avg_mastery ?? 0);

        // Recent registrations (last 7 days)
        $recentUsers = User::where('created_at', '>=', now()->subDays(7))
            ->selectRaw('role, COUNT(*) as count, DATE(created_at) as date')
            ->groupBy('role', 'date')
            ->orderByDesc('date')
            ->get()
            ->groupBy('role');

        // Schools with teacher/learner counts (explicit select of required columns)
        $schools = School::where('is_active', true)
            ->select(['id', 'name', 'city'])
            ->withCount([
                'teacherProfiles as teacher_count',
                'learnerProfiles as learner_count',
                'classes as class_count',
            ])
            ->get()
            ->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'city' => $s->city,
                'teacher_count' => (int) $s->teacher_count,
                'learner_count' => (int) $s->learner_count,
                'class_count' => (int) $s->class_count,
            ]);

        // Top teachers by student count (explicit column projection on relations)
        $topTeachers = User::where('role', 'teacher')
            ->select(['id', 'name'])
            ->with([
                'teacherProfile' => fn ($q) => $q->select(['id', 'user_id', 'school_id']),
                'teacherProfile.school' => fn ($q) => $q->select(['id', 'name']),
            ])
            ->withCount(['classMemberships as learner_count' => function ($q) {
                $q->where('role', 'learner');
            }])
            ->orderByDesc('learner_count')
            ->limit(5)
            ->get()
            ->filter(fn ($t) => $t->learner_count > 0)
            ->values()
            ->map(fn ($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'school' => $t->teacherProfile?->school?->name ?? 'Unassigned',
                'learner_count' => (int) $t->learner_count,
            ]);

        // Struggling learners (avg mastery < 40%)
        $strugglingCount = DB::table('learner_progress')
            ->selectRaw('user_id')
            ->groupBy('user_id')
            ->havingRaw('AVG(mastery_score) < 40')
            ->get()
            ->count();

        return response()->json([
            'overview' => [
                'total_schools' => $totalSchools,
                'total_teachers' => $totalTeachers,
                'total_learners' => $totalLearners,
                'total_classes' => $totalClasses,
                'total_subjects' => $totalSubjects,
                'total_quizzes' => $totalQuizzes,
                'total_attempts' => $totalAttempts,
                'total_questions_answered' => (int) $totalQuestionsAnswered,
                'avg_mastery' => round($avgMastery),
                'struggling_learners' => $strugglingCount,
            ],
            'schools' => $schools,
            'top_teachers' => $topTeachers,
            'recent_users' => $recentUsers,
        ]);
    }
}
