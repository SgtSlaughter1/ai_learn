<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'metadata' => 'array',
        'exam_year' => 'integer',
        'question_number' => 'integer',
    ];

    public function topic(): BelongsTo
    {
        return $this->belongsTo(Topic::class);
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuestionOption::class)->orderBy('sort_order');
    }

    public function isGeneralKnowledge(): bool
    {
        return is_null($this->school_id);
    }

    public function getIsPastQuestionAttribute(): bool
    {
        return !empty($this->exam_code);
    }

    public function getExamDisplayNameAttribute(): ?string
    {
        return match (strtolower((string) $this->exam_code)) {
            'jamb', 'utme' => 'JAMB (UTME)',
            'waec', 'wassce' => 'WAEC (WASSCE)',
            'neco' => 'NECO (SSCE)',
            'bece', 'junior_waec' => 'BECE (Junior WAEC)',
            'post_utme' => 'Post-UTME',
            default => $this->exam_code ? strtoupper($this->exam_code) : null,
        };
    }

    public function getCorrectOptionAttribute(): ?QuestionOption
    {
        return $this->options->firstWhere('is_correct', true);
    }

    public function scopePastQuestions(Builder $query): Builder
    {
        return $query->whereNotNull('exam_code');
    }

    public function scopeForExam(Builder $query, string $examCode, ?int $year = null): Builder
    {
        $q = $query->where('exam_code', strtolower($examCode));
        if ($year) {
            $q->where('exam_year', $year);
        }
        return $q;
    }
}
