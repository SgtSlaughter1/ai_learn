<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Topic extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class);
    }

    public function pastQuestions(): HasMany
    {
        return $this->hasMany(PastQuestion::class);
    }

    /**
     * Scope topics query based on the authenticated user's role, school, and grade permissions.
     */
    public function scopeForUser($query, ?User $user)
    {
        if (! $user) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->isPlatformAdmin()) {
            return $query;
        }

        $allowedGrades = $user->allowedGradeLevels();
        $allowedVariants = School::gradeLevelVariants($allowedGrades);

        if ($user->isSchoolAdmin()) {
            $schoolId = $user->primarySchool()?->id;

            return $query->whereHas('subject', function ($sub) use ($schoolId) {
                $sub->where(function ($sq) use ($schoolId) {
                    $sq->where('school_id', $schoolId)->orWhereNull('school_id');
                });
            })->when(! empty($allowedVariants), function ($tq) use ($allowedVariants) {
                $tq->where(function ($subTq) use ($allowedVariants) {
                    $subTq->whereIn('level', $allowedVariants)
                        ->orWhereNull('level');
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

            return $query->whereHas('subject', function ($sub) use ($teacherClassIds) {
                $sub->whereIn('class_id', $teacherClassIds);
            })->when(! empty($allowedVariants), function ($tq) use ($allowedVariants) {
                $tq->where(function ($subTq) use ($allowedVariants) {
                    $subTq->whereIn('level', $allowedVariants)
                        ->orWhereNull('level');
                });
            });
        }

        return $query;
    }
}
