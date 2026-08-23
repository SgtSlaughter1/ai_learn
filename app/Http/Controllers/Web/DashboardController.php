<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\LearnerProgress;
use App\Models\QuizAttempt;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): mixed
    {
        $user = $request->user();
        if ($user->role === \App\Enums\UserRole::TEACHER) {
            return redirect('/teacher/dashboard');
        }
        if ($user->role === \App\Enums\UserRole::ADMIN) {
            return redirect('/admin/dashboard');
        }
        return Inertia::render('Dashboard');
    }

    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get key statistics
        $totalSubjects = Subject::where('status', 'active')->count();
        
        // Sum total questions attempted and correct
        $progressStats = LearnerProgress::where('user_id', $user->id)
            ->selectRaw('SUM(questions_attempted) as attempted, SUM(questions_correct) as correct, AVG(mastery_score) as avg_mastery')
            ->first();

        $completedTopicsCount = LearnerProgress::where('user_id', $user->id)
            ->where('mastery_score', '>=', 80) // 80% mastery threshold
            ->count();

        // Get recent quiz attempts
        $recentAttempts = QuizAttempt::with('quiz:id,title')
            ->where('user_id', $user->id)
            ->orderBy('started_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($attempt) {
                return [
                    'id' => $attempt->id,
                    'quiz_title' => $attempt->quiz->title,
                    'status' => $attempt->status,
                    'score' => $attempt->score,
                    'total_marks' => $attempt->total_marks,
                    'completed_at' => $attempt->completed_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'stats' => [
                'totalSubjects' => $totalSubjects,
                'questionsAttempted' => (int) ($progressStats->attempted ?? 0),
                'questionsCorrect' => (int) ($progressStats->correct ?? 0),
                'averageMastery' => round($progressStats->avg_mastery ?? 0),
                'completedTopics' => $completedTopicsCount,
            ],
            'recentAttempts' => $recentAttempts,
        ]);
    }
}
