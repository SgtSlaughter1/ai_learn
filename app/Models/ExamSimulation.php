<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExamSimulation extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'subject_ids' => 'array',
            'answers' => 'array',
            'topic_breakdown' => 'array',
            'score_percentage' => 'float',
            'total_questions' => 'integer',
            'correct_answers' => 'integer',
            'duration_seconds' => 'integer',
            'time_spent_seconds' => 'integer',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function getExamDisplayNameAttribute(): string
    {
        return match (strtolower((string) $this->exam_code)) {
            'jamb', 'utme' => 'JAMB (UTME)',
            'waec', 'wassce' => 'WAEC (WASSCE)',
            'neco' => 'NECO (SSCE)',
            'bece', 'junior_waec' => 'BECE (Junior WAEC)',
            default => strtoupper($this->exam_code),
        };
    }
}
