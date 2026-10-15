<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sync\SyncGamificationRequest;
use App\Http\Requests\Sync\SyncProgressRequest;
use App\Models\LearnerProgress;
use App\Services\Gamification\GamificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class SyncController extends Controller
{
    /**
     * Lightweight check the sync engine calls before draining its queue: confirms the
     * session is still valid, refreshes the XSRF cookie, and tells the client which user
     * owns the session so it never uploads another user's offline work.
     */
    public function session(): JsonResponse
    {
        return response()->json(['user_id' => auth()->id()]);
    }

    /**
     * Sync offline learner progress records back to the server.
     * Called by SyncService.ts when the user comes back online.
     */
    public function syncProgress(SyncProgressRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = auth()->user();

        DB::transaction(function () use ($validated, $user) {
            // createOrFirst relies on the unique (user_id, topic_id) index, so two concurrent
            // syncs for the same topic cannot both insert.
            $progress = LearnerProgress::createOrFirst(
                ['user_id' => $user->id, 'topic_id' => $validated['topic_id']],
                [
                    'questions_attempted' => $validated['questions_attempted'],
                    'questions_correct'   => $validated['questions_correct'],
                    'mastery_score'       => $validated['mastery_score'],
                    'ability_score'       => $validated['ability_score'] ?? 1000,
                    'last_attempted_at'   => now(),
                ]
            );

            if ($progress->wasRecentlyCreated) {
                return;
            }

            $progress = LearnerProgress::whereKey($progress->id)->lockForUpdate()->first();

            // Only update if offline data shows more attempts (prevents rolling back progress)
            if ($validated['questions_attempted'] > $progress->questions_attempted) {
                $progress->update([
                    'questions_attempted' => $validated['questions_attempted'],
                    'questions_correct'   => $validated['questions_correct'],
                    'mastery_score'       => max($progress->mastery_score, $validated['mastery_score']),
                    'ability_score'       => $validated['ability_score'] ?? $progress->ability_score,
                    'last_attempted_at'   => now(),
                ]);
            }
        });

        return response()->json(['success' => true]);
    }

    /**
     * Retired: the client used to push an absolute XP total here, which double-counted XP
     * already awarded by quiz sync and let a device overwrite the server's figure.
     * XP is now only awarded by the server for graded events. Kept as a no-op so older
     * cached app versions stop retrying, and returns the authoritative server state.
     */
    public function syncGamification(SyncGamificationRequest $request): JsonResponse
    {
        $profile = app(GamificationService::class)->getProfile(auth()->user());

        return response()->json([
            'success'        => true,
            'total_xp'       => $profile->total_xp,
            'level'          => $profile->level,
            'tier'           => $profile->tier,
            'current_streak' => $profile->current_streak,
            'longest_streak' => $profile->longest_streak,
        ]);
    }
}
