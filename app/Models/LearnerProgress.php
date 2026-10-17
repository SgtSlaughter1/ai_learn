<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;

class LearnerProgress extends Model
{
    use HasFactory;

    protected $table = 'learner_progress';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'last_attempted_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    /**
     * Add one activity's results to the learner's topic progress.
     *
     * Each topic is one atomic UPDATE that adds the new counts and recomputes mastery from
     * them, so concurrent syncs never lose an update and the cost doesn't grow with the
     * learner's history (no re-scan of past answers).
     *
     * @param  array<int, array{attempted: int, correct: int}>  $tallies  keyed by topic id
     */
    public static function recordResults(string $userId, array $tallies, \DateTimeInterface $at): void
    {
        foreach ($tallies as $topicId => $tally) {
            $attempted = (int) $tally['attempted'];
            $correct = (int) $tally['correct'];
            if (! $topicId || $attempted === 0) {
                continue;
            }

            $row = static::createOrFirst(
                ['user_id' => $userId, 'topic_id' => $topicId],
                ['questions_attempted' => 0, 'questions_correct' => 0, 'mastery_score' => 0]
            );

            // mastery_score first: MySQL applies SET clauses left to right.
            static::whereKey($row->getKey())->update([
                'mastery_score' => DB::raw("ROUND(100.0 * (questions_correct + {$correct}) / (questions_attempted + {$attempted}))"),
                'questions_attempted' => DB::raw("questions_attempted + {$attempted}"),
                'questions_correct' => DB::raw("questions_correct + {$correct}"),
                'last_attempted_at' => $at,
            ]);
        }
    }
}
