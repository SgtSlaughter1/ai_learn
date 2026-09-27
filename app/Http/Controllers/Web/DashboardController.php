<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\LearnerProgress;
use App\Models\QuizAttempt;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Render the learner home dashboard.
     */
    public function showLearnerDashboard(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user?->isAdmin()) {
            return redirect('/admin/dashboard');
        }
        if ($user?->isTeacher()) {
            return redirect('/teacher/dashboard');
        }
        return Inertia::render('Dashboard');
    }

    /**
     * Backward-compatible alias for showLearnerDashboard.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        return $this->showLearnerDashboard($request);
    }

    /**
     * Retrieve aggregated progress and mastery stats for the authenticated learner.
     * Cached on backend for 5 minutes.
     */
    public function getLearnerStats(Request $request): JsonResponse
    {
        $user = $request->user();
        $cacheKey = "analytics:learner:{$user->id}";

        $data = Cache::remember($cacheKey, now()->addMinutes(5), function () use ($user) {
            $totalSubjects = Subject::where('status', 'active')->count();

            $progressStats = LearnerProgress::where('user_id', $user->id)
                ->selectRaw('
                    SUM(questions_attempted) as attempted,
                    SUM(questions_correct) as correct,
                    AVG(mastery_score) as avg_mastery,
                    COUNT(CASE WHEN mastery_score >= 80 THEN 1 END) as completed_topics
                ')
                ->first();

            $recentAttempts = QuizAttempt::with('quiz:id,title')
                ->where('user_id', $user->id)
                ->orderBy('started_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($attempt) {
                    return [
                        'id' => (string) $attempt->id,
                        'quiz_title' => $attempt->quiz?->title ?? ('Quiz #' . $attempt->quiz_id),
                        'status' => $attempt->status,
                        'score' => $attempt->score,
                        'total_marks' => $attempt->total_marks,
                        'completed_at' => $attempt->completed_at?->toIso8601String(),
                    ];
                })
                ->values()
                ->all();

            return [
                'stats' => [
                    'totalSubjects' => $totalSubjects,
                    'questionsAttempted' => (int) ($progressStats?->attempted ?? 0),
                    'questionsCorrect' => (int) ($progressStats?->correct ?? 0),
                    'averageMastery' => (int) round($progressStats?->avg_mastery ?? 0),
                    'completedTopics' => (int) ($progressStats?->completed_topics ?? 0),
                ],
                'recentAttempts' => $recentAttempts,
            ];
        });

        return response()->json($data);
    }

    /**
     * Backward-compatible alias for getLearnerStats.
     */
    public function getStats(Request $request): JsonResponse
    {
        return $this->getLearnerStats($request);
    }
}
