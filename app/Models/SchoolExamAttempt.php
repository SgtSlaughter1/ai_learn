<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SchoolExamAttempt extends Model
{
    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_AUTO_SUBMITTED = 'auto_submitted';

    public const STATUS_ENDED = 'ended'; // ended by the invigilator

    /** Answers that arrive this long after the deadline still count (a slow network on the last tap). */
    public const GRACE_SECONDS = 30;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'paper' => 'array',
            'answers' => 'array',
            'topic_breakdown' => 'array',
            'answered_count' => 'integer',
            'left_screen_count' => 'integer',
            'extra_minutes' => 'integer',
            'score' => 'integer',
            'max_score' => 'integer',
            'percentage' => 'float',
            'started_at' => 'datetime',
            'deadline_at' => 'datetime',
            'submitted_at' => 'datetime',
        ];
    }

    public function exam(): BelongsTo
    {
        return $this->belongsTo(SchoolExam::class, 'school_exam_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isInProgress(): bool
    {
        return $this->status === self::STATUS_IN_PROGRESS;
    }

    /** Still taking answers: in progress and not past the deadline (plus grace). */
    public function acceptsAnswers(): bool
    {
        return $this->isInProgress() && now()->lte($this->deadline_at->copy()->addSeconds(self::GRACE_SECONDS));
    }

    public function secondsLeft(): int
    {
        return max(0, (int) now()->diffInSeconds($this->deadline_at, false));
    }

    /** In-progress attempts whose time (and grace) has run out, waiting to be closed and marked. */
    public function scopeOverdue(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_IN_PROGRESS)
            ->where('deadline_at', '<', now()->subSeconds(self::GRACE_SECONDS));
    }
}
