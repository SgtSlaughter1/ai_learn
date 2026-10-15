<?php

namespace App\Jobs;

use App\Models\QuizAttempt;
use App\Services\Gamification\GamificationService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;

/**
 * XP, streak and achievements for a synced quiz attempt, off the request path so syncing
 * stays fast when a whole class reconnects. Safe to run more than once: the attempt
 * records when its XP was awarded.
 */
class AwardQuizCompletionXp implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** @var array<int, int> seconds between retries */
    public array $backoff = [10, 30, 60, 300];

    public function __construct(public string $attemptId, public ?string $activityAt = null)
    {
        $this->afterCommit();
    }

    public function uniqueId(): string
    {
        return $this->attemptId;
    }

    public function handle(GamificationService $gamification): void
    {
        $attempt = QuizAttempt::find($this->attemptId);
        if ($attempt) {
            $gamification->awardQuizCompletionOnce($attempt, $this->activityAt ? Carbon::parse($this->activityAt) : null);
        }
    }
}
