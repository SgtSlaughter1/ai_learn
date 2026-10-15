<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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

    public function answers(): HasMany
    {
        return $this->hasMany(QuizAnswer::class);
    }

    public function quizzes(): BelongsToMany
    {
        return $this->belongsToMany(Quiz::class, 'quiz_questions');
    }

    public function isGeneralKnowledge(): bool
    {
        return is_null($this->school_id);
    }

    public function getCorrectOptionAttribute(): ?QuestionOption
    {
        return $this->options->firstWhere('is_correct', true);
    }

    /**
     * Scope questions query based on the authenticated user's role, school, and grade permissions.
     */
    public function scopeForUser($query, ?User $user)
    {
        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->isPlatformAdmin()) {
            return $query;
        }

        $allowedGrades = $user->allowedGradeLevels();
        $allowedVariants = School::gradeLevelVariants($allowedGrades);

        if ($user->isSchoolAdmin()) {
            $schoolId = $user->primarySchool()?->id;
            return $query->where(function ($q) use ($schoolId) {
                $q->where('school_id', $schoolId)->orWhereNull('school_id');
            })->when(!empty($allowedVariants), function ($q) use ($allowedVariants) {
                $q->whereHas('topic', function ($tq) use ($allowedVariants) {
                    $tq->whereIn('level', $allowedVariants)->orWhereNull('level');
                });
            });
        }

        if ($user->isTeacher()) {
            if ($user->relationLoaded('classes')) {
                $teacherClassIds = $user->classes->pluck('id')->all();
            } else {
                $teacherClassIds = $user->classes()->pluck('classes.id')->all();
            }

            if (empty($teacherClassIds)) {
                return $query->whereRaw('1 = 0');
            }

            return $query->whereHas('topic.subject', function ($sub) use ($teacherClassIds) {
                $sub->whereIn('class_id', $teacherClassIds);
            })->when(!empty($allowedVariants), function ($q) use ($allowedVariants) {
                $q->whereHas('topic', function ($tq) use ($allowedVariants) {
                    $tq->whereIn('level', $allowedVariants)->orWhereNull('level');
                });
            });
        }

        if ($user->isLearner()) {
            $schoolId = $user->primarySchool()?->id;
            $classId = $user->primaryClass()?->id;

            return $query->where(function ($q) use ($schoolId) {
                if ($schoolId) {
                    $q->where('school_id', $schoolId)->orWhereNull('school_id');
                } else {
                    $q->whereNull('school_id');
                }
            })->whereHas('topic.subject', function ($subQuery) use ($classId, $schoolId) {
                if ($classId) {
                    $subQuery->where('class_id', $classId)
                        ->orWhere(function ($sq) use ($schoolId) {
                            if ($schoolId) {
                                $sq->where('school_id', $schoolId)->whereNull('class_id');
                            } else {
                                $sq->whereNull('school_id')->whereNull('class_id');
                            }
                        });
                } else {
                    $subQuery->whereNull('class_id');
                }
            })->when(!empty($allowedVariants), function ($q) use ($allowedVariants) {
                $q->whereHas('topic', function ($tq) use ($allowedVariants) {
                    $tq->whereIn('level', $allowedVariants)->orWhereNull('level');
                });
            });
        }

        return $query;
    }
}
