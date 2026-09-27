<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Revision\CompleteRevisionSessionRequest;
use App\Http\Requests\Revision\SubmitReviewRequest;
use App\Services\Gamification\GamificationService;
use App\Services\SpacedRepetition\SpacedRepetitionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SpacedRepetitionController extends Controller
{
    public function __construct(
        protected SpacedRepetitionService $spacedRepetitionService,
        protected GamificationService $gamificationService
    ) {}

    /**
     * Get Today's 5-Minute Spaced Repetition Queue.
     */
    public function getTodayQueue(Request $request): JsonResponse
    {
        $user = Auth::user() ?? $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated',
                'data' => [
                    'total_due_today' => 0,
                    'estimated_minutes' => 5,
                    'items' => [],
                ],
            ], 401);
        }

        $limit = min((int) ($request->query('limit', 6)), 20);
        $queueData = $this->spacedRepetitionService->getTodayQueue($user, $limit);

        return response()->json([
            'success' => true,
            'data' => $queueData,
        ]);
    }

    /**
     * Submit an answer to a single revision question.
     */
    public function submitReview(SubmitReviewRequest $request): JsonResponse
    {
        $user = Auth::user() ?? $request->user();
        $validated = $request->validated();

        $result = $this->spacedRepetitionService->submitReview($user, $validated['item_id'], $validated);

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * Finalize today's revision session, award daily streak bonus XP (+25 XP), and return summary.
     */
    public function completeSession(CompleteRevisionSessionRequest $request): JsonResponse
    {
        $user = Auth::user() ?? $request->user();
        $validated = $request->validated();

        $completedCount = (int) ($validated['completed_count'] ?? 0);
        $correctCount = (int) ($validated['correct_count'] ?? 0);

        $gamificationResult = $this->gamificationService->processRevisionCompletion(
            $user,
            $correctCount,
            $completedCount
        );

        return response()->json([
            'success' => true,
            'data' => [
                'bonus_xp' => $gamificationResult['bonus_xp'] ?? 0,
                'total_xp' => $gamificationResult['total_xp'] ?? null,
                'level' => $gamificationResult['level'] ?? null,
                'tier' => $gamificationResult['tier'] ?? null,
                'new_achievements' => $gamificationResult['new_achievements'] ?? [],
                'completed_count' => $completedCount,
                'correct_count' => $correctCount,
                'streak_maintained' => true,
            ],
        ]);
    }

    /**
     * Get aggregate statistics.
     */
    public function getStats(Request $request): JsonResponse
    {
        $user = Auth::user() ?? $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $stats = $this->spacedRepetitionService->getStats($user);

        return response()->json([
            'success' => true,
            'data' => $stats,
        ]);
    }
}
