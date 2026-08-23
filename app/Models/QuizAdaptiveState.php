<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'quiz_attempt_id',
    'user_id',
    'quiz_id',
    'current_ability',
    'questions_answered',
    'correct_count',
    'answered_question_ids',
    'answer_results',
    'is_completed',
])]
class QuizAdaptiveState extends Model
{
    use HasFactory;

    protected $casts = [
        'answered_question_ids' => 'array',
        'answer_results'        => 'array',
        'is_completed'          => 'boolean',
    ];

    public function attempt(): BelongsTo
    {
        return $this->belongsTo(QuizAttempt::class, 'quiz_attempt_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }
}
