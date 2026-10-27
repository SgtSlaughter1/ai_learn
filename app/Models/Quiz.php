<?php

namespace App\Models;

use App\Support\AttemptQuestions;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class Quiz extends Model
{
    use HasFactory;

    /** Learners get this many questions per attempt (all of them for a smaller quiz). */
    public const QUESTIONS_PER_ATTEMPT = 10;

    protected $guarded = [];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function questions(): BelongsToMany
    {
        return $this->belongsToMany(Question::class, 'quiz_questions')
            ->withPivot(['sort_order', 'marks'])
            ->orderByPivot('sort_order');
    }

    /**
     * The questions an attempt is graded on, from the quiz's loaded (active) questions.
     * Every attempt covers a full set: if fewer distinct quiz questions were submitted,
     * the rest are added unanswered, so sending only answers you already know cannot
     * produce a perfect score.
     */
    public function questionsForAttempt(array $submittedQuestionIds): Collection
    {
        $submitted = $this->questions->whereIn('id', $submittedQuestionIds)->values();
        $required = min(self::QUESTIONS_PER_ATTEMPT, $this->questions->count());

        if ($submitted->count() >= $required) {
            return $submitted;
        }

        // Missing questions are added a whole passage at a time, like any attempt is picked.
        $unanswered = AttemptQuestions::pick(
            $this->questions->whereNotIn('id', $submitted->pluck('id')->all())->values(),
            $required - $submitted->count(),
            shuffle: false,
        );

        return $submitted->concat($unanswered)->values();
    }

    public function attempts(): HasMany
    {
        return $this->hasMany(QuizAttempt::class);
    }

    public function isGeneralKnowledge(): bool
    {
        return $this->school_id === null;
    }
}
