<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class School extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public static function allowedGradeLevelsForCategory(?string $category): array
    {
        return match ($category) {
            'primary' => ['CRECHE', 'KG1', 'KG2', 'NUR1', 'NUR2', 'PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'],
            'junior' => ['JSS1', 'JSS2', 'JSS3'],
            'senior' => ['SS1', 'SS2', 'SS3'],
            default => [
                'CRECHE', 'KG1', 'KG2', 'NUR1', 'NUR2',
                'PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6',
                'JSS1', 'JSS2', 'JSS3',
                'SS1', 'SS2', 'SS3',
            ],
        };
    }

    public function allowedGradeLevels(): array
    {
        return self::allowedGradeLevelsForCategory($this->category);
    }

    public function supportsGradeLevel(string $gradeLevel): bool
    {
        return in_array(strtoupper($gradeLevel), $this->allowedGradeLevels(), true);
    }

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function teacherProfiles(): HasMany
    {
        return $this->hasMany(TeacherProfile::class);
    }

    public function learnerProfiles(): HasMany
    {
        return $this->hasMany(LearnerProfile::class);
    }

    public function classes(): HasMany
    {
        return $this->hasMany(ClassModel::class);
    }

    public function teachers(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, TeacherProfile::class, 'school_id', 'id', null, 'user_id');
    }

    public function learners(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, LearnerProfile::class, 'school_id', 'id', null, 'user_id');
    }
}
