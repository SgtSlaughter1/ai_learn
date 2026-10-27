<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\Gamification\GamificationService;
use App\Services\Gamification\LeaderboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GamificationController extends Controller
{
    public function __construct(
        private GamificationService $gamificationService,
        private LeaderboardService $leaderboard,
    ) {}

    /**
     * Get the user's full gamification profile.
     */
    public function profile(Request $request): JsonResponse
    {
        $data = $this->gamificationService->getDashboardData($request->user());

        return response()->json($data);
    }

    /**
     * Get the leaderboard.
     */
    public function leaderboard(Request $request): JsonResponse
    {
        $data = $this->leaderboard->board($request->user());

        return response()->json($data);
    }

    public function getProfile(Request $request): JsonResponse
    {
        return $this->profile($request);
    }

    public function getLeaderboard(Request $request): JsonResponse
    {
        return $this->leaderboard($request);
    }
}
