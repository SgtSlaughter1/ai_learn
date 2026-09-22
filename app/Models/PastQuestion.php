<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PastQuestion extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'exam_year' => 'integer',
        'question_number' => 'integer',
        'metadata' => 'array',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(PastQuestionOption::class)->orderBy('sort_order', 'asc');
    }

    public function correctOption(): ?PastQuestionOption
    {
        return $this->options->firstWhere('is_correct', true);
    }

    public function getExamDisplayNameAttribute(): string
    {
        return match (strtolower($this->exam_code)) {
            'jamb', 'utme' => 'JAMB / UTME',
            'waec', 'wassce' => 'WAEC / WASSCE',
            'neco' => 'NECO (Senior Secondary)',
            'bece', 'junior_waec' => 'BECE (Junior Secondary)',
            'post_utme', 'post-utme' => 'Post-UTME Screenings',
            default => strtoupper($this->exam_code),
        };
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    public function scopeForExam($query, string $examCode)
    {
        return $query->where('exam_code', strtolower($examCode));
    }

    public function scopeForSubject($query, $subjectId)
    {
        return $query->where('subject_id', $subjectId);
    }

    public function scopeForYear($query, int $year)
    {
        return $query->where('exam_year', $year);
    }
}
