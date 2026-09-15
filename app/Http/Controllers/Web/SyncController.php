<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\LearnerProgress;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SyncController extends Controller
{
    /**
     * Sync offline learner progress records back to the server.
     * Called by SyncService.ts when the user comes back online.
     */
    public function syncProgress(Request $request): JsonResponse
    {
        $request->validate([
            'topic_id'            => ['required', 'integer', 'exists:topics,id'],
            'questions_attempted' => ['required', 'integer', 'min:0'],
            'questions_correct'   => ['required', 'integer', 'min:0'],
            'mastery_score'       => ['required', 'numeric', 'min:0', 'max:100'],
            'ability_score'       => ['nullable', 'numeric'],
        ]);

        $user = auth()->user();

        // Merge offline progress with existing server-side progress (take the higher values)
        $existing = LearnerProgress::where('user_id', $user->id)
            ->where('topic_id', $request->topic_id)
            ->first();

        if ($existing) {
            // Only update if offline data shows more attempts (prevents rolling back progress)
            if ($request->questions_attempted > $existing->questions_attempted) {
                $existing->update([
                    'questions_attempted' => $request->questions_attempted,
                    'questions_correct'   => $request->questions_correct,
                    'mastery_score'       => max($existing->mastery_score, $request->mastery_score),
                    'ability_score'       => $request->ability_score ?? $existing->ability_score,
                    'last_attempted_at'   => now(),
                ]);
            }
        } else {
            LearnerProgress::create([
                'user_id'             => $user->id,
                'topic_id'            => $request->topic_id,
                'questions_attempted' => $request->questions_attempted,
                'questions_correct'   => $request->questions_correct,
                'mastery_score'       => $request->mastery_score,
                'ability_score'       => $request->ability_score ?? 1000,
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
    public function syncGamification(Request $request): JsonResponse
    {
        $request->validate([
            'total_xp'       => ['required', 'integer', 'min:0'],
            'level'          => ['required', 'integer', 'min:1'],
            'tier'           => ['nullable', 'string'],
            'current_streak' => ['required', 'integer', 'min:0'],
            'longest_streak' => ['required', 'integer', 'min:0'],
        ]);

        $user = auth()->user();

        $gamification = UserGamification::where('user_id', $user->id)->first();

        if ($gamification && $request->total_xp > $gamification->total_xp) {
            $xpDiff = $request->total_xp - $gamification->total_xp;

            $gamification->update([
                'total_xp'       => $request->total_xp,
                'level'          => max($gamification->level, $request->level),
                'current_streak' => max($gamification->current_streak, $request->current_streak),
                'longest_streak' => max($gamification->longest_streak, $request->longest_streak),
            ]);

            app(\App\Services\Gamification\GamificationService::class)->recalculateLevel($gamification);

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
