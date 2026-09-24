<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SpacedRepetitionItem extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'ease_factor' => 'float',
            'interval_days' => 'integer',
            'repetition_level' => 'integer',
            'consecutive_correct' => 'integer',
            'total_reviews' => 'integer',
            'total_mistakes' => 'integer',
            'last_reviewed_at' => 'datetime',
            'next_review_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function pastQuestion(): BelongsTo
    {
        return $this->belongsTo(PastQuestion::class, 'past_question_id');
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    /**
     * Scope items that are scheduled / due for review today or overdue.
     */
    public function scopeDueToday($query, $userId)
    {
        return $query->where('user_id', $userId)
            ->where('status', 'active')
            ->where(function ($q) {
                $q->whereNull('next_review_at')
                  ->orWhere('next_review_at', '<=', now());
            });
    }

    /**
     * Scope mastered items.
     */
    public function scopeMastered($query, $userId)
    {
        return $query->where('user_id', $userId)
            ->where('status', 'mastered');
    }
}
