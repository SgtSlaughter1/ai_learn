<?php

namespace App\Services\Gamification;

use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Support\Facades\Cache;

/**
 * The XP leaderboard: the top learners and the current learner's own position.
 */
class LeaderboardService
{
    public function __construct(private GamificationService $gamification) {}

    /**
     * Retrieve the leaderboard standings and the current user's placement.
     */
    public function board(User $currentUser, int $limit = 10): array
    {
        $topUsersData = Cache::remember("gamification:leaderboard:top:{$limit}", now()->addMinutes(5), function () use ($limit) {
            return UserGamification::with('user:id,name')
                ->whereHas('user')
                ->orderByDesc('total_xp')
                ->limit($limit)
                ->get()
                ->map(fn (UserGamification $g, int $index) => [
                    'position' => $index + 1,
                    'user_id' => $g->user_id,
                    'name' => $g->user->name ?? 'Unknown',
                    'total_xp' => $g->total_xp,
                    'level' => $g->level,
                    'tier' => $g->tier ?? 'Newcomer',
                ])
                ->all();
        });

        $topUsers = array_map(function ($item) use ($currentUser) {
            $item['is_current_user'] = $item['user_id'] === $currentUser->id;

            return $item;
        }, $topUsersData);

        // Profile first: comparing against a learner's missing row (> NULL) counted nobody, so
        // every new learner was told they were #1.
        $currentUserProfile = $this->gamification->getProfile($currentUser);
        $currentUserPosition = UserGamification::where('total_xp', '>', (int) $currentUserProfile->total_xp)
            ->whereHas('user')
            ->count() + 1;
        $currentUserEntry = [
            'position' => $currentUserPosition,
            'user_id' => $currentUser->id,
            'name' => $currentUser->name,
            'total_xp' => $currentUserProfile->total_xp,
            'level' => $currentUserProfile->level,
            'tier' => $currentUserProfile->tier ?? 'Newcomer',
            'is_current_user' => true,
        ];

        return [
            'top_users' => $topUsers,
            'current_user' => $currentUserEntry,
            'current_user_in_top' => collect($topUsers)->contains('user_id', $currentUser->id),
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Internal Progression & Recalculation
}
