<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'topic_id', 'questions_attempted', 'questions_correct', 'mastery_score', 'ability_score', 'last_attempted_at'])]
class LearnerProgress extends Model
{
    use HasFactory;

    protected $table = 'learner_progress';

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
}
