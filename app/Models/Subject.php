<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Subject extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(ClassModel::class, 'class_id');
    }

    public function topics(): HasMany
    {
        return $this->hasMany(Topic::class)->orderBy('sort_order');
    }

    public function pastQuestions(): HasMany
    {
        return $this->hasMany(PastQuestion::class);
    }

    public function isGeneralKnowledge(): bool
    {
        return $this->school_id === null;
    }

    /**
     * Scope subjects query based on the authenticated user's role and permissions.
     */
    public function scopeForUser($query, ?User $user)
    {
        if (!$user) {
            return $query->whereRaw('1 = 0');
        }

        if ($user->isPlatformAdmin()) {
            return $query;
        }

        if ($user->isSchoolAdmin()) {
            $schoolId = $user->primarySchool()?->id;
            return $query->where(function ($q) use ($schoolId) {
                $q->where('school_id', $schoolId)
                  ->orWhereNull('school_id');
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

            return $query->whereIn('class_id', $teacherClassIds);
        }

        if ($user->isLearner()) {
            $classId = $user->primaryClass()?->id;
            return $query->where(function ($q) use ($classId) {
                if ($classId) {
                    $q->where('class_id', $classId)->orWhereNull('class_id');
                } else {
                    $q->whereNull('class_id');
                }
            });
        }

        return $query;
    }
}
