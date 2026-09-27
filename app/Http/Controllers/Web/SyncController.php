<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sync\SyncGamificationRequest;
use App\Http\Requests\Sync\SyncProgressRequest;
use App\Models\LearnerProgress;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use App\Services\Gamification\GamificationService;
use Illuminate\Http\JsonResponse;

class SyncController extends Controller
{
    /**
     * Sync offline learner progress records back to the server.
     * Called by SyncService.ts when the user comes back online.
     */
    public function syncProgress(SyncProgressRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = auth()->user();

        // Merge offline progress with existing server-side progress (take the higher values)
        $existing = LearnerProgress::where('user_id', $user->id)
            ->where('topic_id', $validated['topic_id'])
            ->first();

        if ($existing) {
            // Only update if offline data shows more attempts (prevents rolling back progress)
            if ($validated['questions_attempted'] > $existing->questions_attempted) {
                $existing->update([
                    'questions_attempted' => $validated['questions_attempted'],
                    'questions_correct'   => $validated['questions_correct'],
                    'mastery_score'       => max($existing->mastery_score, $validated['mastery_score']),
                    'ability_score'       => $validated['ability_score'] ?? $existing->ability_score,
                    'last_attempted_at'   => now(),
                ]);
            }
        } else {
            LearnerProgress::create([
                'user_id'             => $user->id,
                'topic_id'            => $validated['topic_id'],
                'questions_attempted' => $validated['questions_attempted'],
                'questions_correct'   => $validated['questions_correct'],
                'mastery_score'       => $validated['mastery_score'],
                'ability_score'       => $validated['ability_score'] ?? 1000,
                'last_attempted_at'   => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Sync offline gamification state back to the server.
     * Called by SyncService.ts when the user comes back online.
     * We only update if the offline data shows higher XP (never decrease XP from sync).
     */
    public function syncGamification(SyncGamificationRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = auth()->user();

        $gamification = UserGamification::where('user_id', $user->id)->first();

        if ($gamification && $validated['total_xp'] > $gamification->total_xp) {
            $xpDiff = $validated['total_xp'] - $gamification->total_xp;

            $gamification->update([
                'total_xp'       => $validated['total_xp'],
                'level'          => max($gamification->level, $validated['level']),
                'current_streak' => max($gamification->current_streak, $validated['current_streak']),
                'longest_streak' => max($gamification->longest_streak, $validated['longest_streak']),
            ]);

            app(GamificationService::class)->recalculateLevel($gamification);

            // Log the synced XP as a transaction so it shows in the dashboard
            if ($xpDiff > 0) {
                XpTransaction::create([
                    'user_id'     => $user->id,
                    'amount'      => $xpDiff,
                    'source'      => 'offline_sync',
                    'description' => 'XP earned while offline',
                ]);
            }
        }

        return response()->json(['success' => true]);
    }
}
