<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class ClassModel extends Model
{
    /** School grades in teaching order, for sorting classes and finding the next grades. */
    public const GRADE_ORDER = ['CRECHE' => 1, 'KG1' => 2, 'KG2' => 3, 'NUR1' => 4, 'NUR2' => 5, 'PRI1' => 6, 'PRI2' => 7, 'PRI3' => 8, 'PRI4' => 9, 'PRI5' => 10, 'PRI6' => 11, 'JSS1' => 12, 'JSS2' => 13, 'JSS3' => 14, 'SS1' => 15, 'SS2' => 16, 'SS3' => 17];

    protected $table = 'classes';

    protected $guarded = [];

    protected $appends = [
        'school_class_arm',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function getSchoolClassArmAttribute(): ?string
    {
        return $this->arm ?? $this->section;
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
    }

    public function program(): BelongsTo
    {
        return $this->belongsTo(Program::class, 'program_id');
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(Subject::class, 'class_id')->orderBy('sort_order');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClassMembership::class, 'class_id');
    }

    public function teachers(): HasMany
    {
        return $this->memberships()->where('role', 'teacher');
    }

    public function learners(): HasMany
    {
        return $this->memberships()->where('role', 'learner');
    }

    public function teacherUsers(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, ClassMembership::class, 'class_id', 'id', 'id', 'user_id')
            ->where('class_memberships.role', 'teacher');
    }

    public function learnerUsers(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, ClassMembership::class, 'class_id', 'id', 'id', 'user_id')
            ->where('class_memberships.role', 'learner');
    }

    /**
     * Scope classes query based on the authenticated user's role and permissions.
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
            $allowedGrades = $user->allowedGradeLevels();
            return $query->where('school_id', $schoolId)
                ->when(!empty($allowedGrades), fn ($q) => $q->whereIn('grade_level', $allowedGrades));
        }

        if ($user->isTeacher()) {
            if ($user->relationLoaded('classes')) {
                $classIds = $user->classes->pluck('id')->all();
                return $query->whereIn('id', $classIds);
            }
            return $query->whereHas('memberships', fn ($q) => $q->where('user_id', $user->id)->where('role', 'teacher'));
        }

        if ($user->isLearner()) {
            $classId = $user->primaryClass()?->id;
            return $query->where('id', $classId);
        }

        return $query->whereRaw('1 = 0');
    }

    /**
     * Scope classes for a specific school.
     */
    public function scopeForSchool($query, ?int $schoolId)
    {
        if (!$schoolId) {
            return $query;
        }
        return $query->where('school_id', $schoolId);
    }
}
