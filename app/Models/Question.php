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

    protected $casts = [];

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

    public function getCorrectOptionAttribute(): ?QuestionOption
    {
        return $this->options->firstWhere('is_correct', true);
    }
}
