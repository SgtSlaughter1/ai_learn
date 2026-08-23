<?php

namespace App\Http\Controllers\Web;

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
use Inertia\Inertia;

class AdminDashboardController extends Controller
{
    public function index(Request $request): mixed
    {
        return Inertia::render('admin/Dashboard');
    }

    public function getStats(Request $request): JsonResponse
    {
        // Platform-wide counts
        $totalSchools = School::where('is_active', true)->count();
        $totalTeachers = User::where('role', 'teacher')->count();
        $totalLearners = User::where('role', 'learner')->count();
        $totalClasses = ClassModel::where('is_active', true)->count();
        $totalSubjects = Subject::where('status', 'active')->count();
        $totalQuizzes = Quiz::where('status', 'active')->count();

        // Activity stats
        $totalAttempts = QuizAttempt::where('status', 'completed')->count();
        $totalQuestionsAnswered = LearnerProgress::sum('questions_attempted');
        $totalCorrectAnswers = LearnerProgress::sum('questions_correct');
        $avgMastery = LearnerProgress::avg('mastery_score') ?? 0;

        // Recent registrations (last 7 days)
        $recentUsers = User::where('created_at', '>=', now()->subDays(7))
            ->selectRaw('role, COUNT(*) as count, DATE(created_at) as date')
            ->groupBy('role', 'date')
            ->orderByDesc('date')
            ->get()
            ->groupBy('role');

        // Schools with teacher/learner counts
        $schools = School::where('is_active', true)
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
                'teacher_count' => $s->teacher_count,
                'learner_count' => $s->learner_count,
                'class_count' => $s->class_count,
            ]);

        // Top teachers by student count
        $topTeachers = User::where('role', 'teacher')
            ->with(['teacherProfile.school'])
            ->withCount(['classMemberships as learner_count' => function ($q) {
                $q->where('role', 'learner');
            }])
            ->orderByDesc('learner_count')
            ->limit(5)
            ->get()
            ->filter(fn ($t) => $t->learner_count > 0)
            ->map(fn ($t) => [
                'id' => $t->id,
                'name' => $t->name,
                'school' => $t->teacherProfile->school->name ?? 'Unassigned',
                'learner_count' => $t->learner_count,
            ]);

        // Struggling learners (avg mastery < 40%)
        $strugglingCount = LearnerProgress::selectRaw('user_id, AVG(mastery_score) as avg')
            ->groupBy('user_id')
            ->having('avg', '<', 40)
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
