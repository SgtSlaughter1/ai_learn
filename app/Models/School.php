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

    protected $appends = [
        'allowed_grade_levels',
        'grade_options',
    ];

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

    public static function gradeOptionsForCategory(?string $category): array
    {
        $all = [
            'CRECHE' => ['value' => 'CRECHE', 'label' => 'Creche', 'group' => 'Early Childhood'],
            'KG1'    => ['value' => 'KG1', 'label' => 'KG 1', 'group' => 'Early Childhood'],
            'KG2'    => ['value' => 'KG2', 'label' => 'KG 2', 'group' => 'Early Childhood'],
            'NUR1'   => ['value' => 'NUR1', 'label' => 'Nursery 1', 'group' => 'Early Childhood'],
            'NUR2'   => ['value' => 'NUR2', 'label' => 'Nursery 2', 'group' => 'Early Childhood'],
            'PRI1'   => ['value' => 'PRI1', 'label' => 'Primary 1', 'group' => 'Primary School'],
            'PRI2'   => ['value' => 'PRI2', 'label' => 'Primary 2', 'group' => 'Primary School'],
            'PRI3'   => ['value' => 'PRI3', 'label' => 'Primary 3', 'group' => 'Primary School'],
            'PRI4'   => ['value' => 'PRI4', 'label' => 'Primary 4', 'group' => 'Primary School'],
            'PRI5'   => ['value' => 'PRI5', 'label' => 'Primary 5', 'group' => 'Primary School'],
            'PRI6'   => ['value' => 'PRI6', 'label' => 'Primary 6', 'group' => 'Primary School'],
            'JSS1'   => ['value' => 'JSS1', 'label' => 'JSS 1', 'group' => 'Junior Secondary'],
            'JSS2'   => ['value' => 'JSS2', 'label' => 'JSS 2', 'group' => 'Junior Secondary'],
            'JSS3'   => ['value' => 'JSS3', 'label' => 'JSS 3', 'group' => 'Junior Secondary'],
            'SS1'    => ['value' => 'SS1', 'label' => 'SS 1', 'group' => 'Senior Secondary'],
            'SS2'    => ['value' => 'SS2', 'label' => 'SS 2', 'group' => 'Senior Secondary'],
            'SS3'    => ['value' => 'SS3', 'label' => 'SS 3', 'group' => 'Senior Secondary'],
        ];

        $allowedKeys = self::allowedGradeLevelsForCategory($category);
        $result = [];
        foreach ($allowedKeys as $key) {
            if (isset($all[$key])) {
                $result[] = $all[$key];
            }
        }
        return $result;
    }

    public function getAllowedGradeLevelsAttribute(): array
    {
        return $this->allowedGradeLevels();
    }

    public function getGradeOptionsAttribute(): array
    {
        return self::gradeOptionsForCategory($this->category);
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
