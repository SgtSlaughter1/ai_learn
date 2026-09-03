<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\LearnerProgress;
use App\Models\QuizAttempt;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function getStats(Request $request): JsonResponse
    {
        $user = $request->user();

        // Get key statistics in a single aggregated query on learner_progress
        $totalSubjects = Subject::where('status', 'active')->count();

        $progressStats = LearnerProgress::where('user_id', $user->id)
            ->selectRaw('
                SUM(questions_attempted) as attempted,
                SUM(questions_correct) as correct,
                AVG(mastery_score) as avg_mastery,
                COUNT(CASE WHEN mastery_score >= 80 THEN 1 END) as completed_topics
            ')
            ->first();

        // Get recent quiz attempts (select only needed fields with eager-loaded quiz)
        $recentAttempts = QuizAttempt::with('quiz:id,title')
            ->where('user_id', $user->id)
            ->orderBy('started_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($attempt) {
                return [
                    'id' => $attempt->id,
                    'quiz_title' => $attempt->quiz?->title ?? 'Quiz Assessment',
                    'status' => $attempt->status,
                    'score' => $attempt->score,
                    'total_marks' => $attempt->total_marks,
                    'completed_at' => $attempt->completed_at?->toIso8601String(),
                ];
            });

        return response()->json([
            'stats' => [
                'totalSubjects' => $totalSubjects,
                'questionsAttempted' => (int) ($progressStats?->attempted ?? 0),
                'questionsCorrect' => (int) ($progressStats?->correct ?? 0),
                'averageMastery' => (int) round($progressStats?->avg_mastery ?? 0),
                'completedTopics' => (int) ($progressStats?->completed_topics ?? 0),
            ],
            'recentAttempts' => $recentAttempts,
        ]);
    }
}
