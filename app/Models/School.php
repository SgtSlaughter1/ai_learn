<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class School extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'category_ids' => 'array',
        ];
    }

    protected $appends = [
        'allowed_grade_levels',
        'grade_options',
        'category_names',
        'category_type_label',
    ];

    /**
     * Grade levels allowed by the given category IDs (all grades when none are set).
     */
    public static function allowedGradeLevelsForCategoryIds(?array $categoryIds): array
    {
        if (empty($categoryIds)) {
            return [
                'CRECHE', 'KG1', 'KG2', 'NUR1', 'NUR2',
                'PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6',
                'JSS1', 'JSS2', 'JSS3',
                'SS1', 'SS2', 'SS3',
            ];
        }

        $grades = [];
        foreach ($categoryIds as $catId) {
            $catGrades = Category::gradeLevelsForId($catId);
            $grades = array_merge($grades, $catGrades);
        }

        return array_values(array_unique($grades));
    }

    public static function gradeOptionsForCategoryIds(?array $categoryIds): array
    {
        $all = [
            'CRECHE' => ['value' => 'CRECHE', 'label' => 'Creche', 'group' => 'Early Childhood'],
            'KG1' => ['value' => 'KG1', 'label' => 'KG 1', 'group' => 'Early Childhood'],
            'KG2' => ['value' => 'KG2', 'label' => 'KG 2', 'group' => 'Early Childhood'],
            'NUR1' => ['value' => 'NUR1', 'label' => 'Nursery 1', 'group' => 'Early Childhood'],
            'NUR2' => ['value' => 'NUR2', 'label' => 'Nursery 2', 'group' => 'Early Childhood'],
            'PRI1' => ['value' => 'PRI1', 'label' => 'Primary 1', 'group' => 'Primary School'],
            'PRI2' => ['value' => 'PRI2', 'label' => 'Primary 2', 'group' => 'Primary School'],
            'PRI3' => ['value' => 'PRI3', 'label' => 'Primary 3', 'group' => 'Primary School'],
            'PRI4' => ['value' => 'PRI4', 'label' => 'Primary 4', 'group' => 'Primary School'],
            'PRI5' => ['value' => 'PRI5', 'label' => 'Primary 5', 'group' => 'Primary School'],
            'PRI6' => ['value' => 'PRI6', 'label' => 'Primary 6', 'group' => 'Primary School'],
            'JSS1' => ['value' => 'JSS1', 'label' => 'JSS 1', 'group' => 'Junior Secondary'],
            'JSS2' => ['value' => 'JSS2', 'label' => 'JSS 2', 'group' => 'Junior Secondary'],
            'JSS3' => ['value' => 'JSS3', 'label' => 'JSS 3', 'group' => 'Junior Secondary'],
            'SS1' => ['value' => 'SS1', 'label' => 'SS 1', 'group' => 'Senior Secondary'],
            'SS2' => ['value' => 'SS2', 'label' => 'SS 2', 'group' => 'Senior Secondary'],
            'SS3' => ['value' => 'SS3', 'label' => 'SS 3', 'group' => 'Senior Secondary'],
        ];

        $allowedKeys = self::allowedGradeLevelsForCategoryIds($categoryIds);

        $result = [];
        foreach ($allowedKeys as $key) {
            if (isset($all[$key])) {
                $result[] = $all[$key];
            }
        }

        return $result;
    }

    public static function filterGradeOptions(array $allowedGradeLevels): array
    {
        $all = [
            'CRECHE' => ['value' => 'CRECHE', 'label' => 'Creche', 'group' => 'Early Childhood'],
            'KG1' => ['value' => 'KG1', 'label' => 'KG 1', 'group' => 'Early Childhood'],
            'KG2' => ['value' => 'KG2', 'label' => 'KG 2', 'group' => 'Early Childhood'],
            'NUR1' => ['value' => 'NUR1', 'label' => 'Nursery 1', 'group' => 'Early Childhood'],
            'NUR2' => ['value' => 'NUR2', 'label' => 'Nursery 2', 'group' => 'Early Childhood'],
            'PRI1' => ['value' => 'PRI1', 'label' => 'Primary 1', 'group' => 'Primary School'],
            'PRI2' => ['value' => 'PRI2', 'label' => 'Primary 2', 'group' => 'Primary School'],
            'PRI3' => ['value' => 'PRI3', 'label' => 'Primary 3', 'group' => 'Primary School'],
            'PRI4' => ['value' => 'PRI4', 'label' => 'Primary 4', 'group' => 'Primary School'],
            'PRI5' => ['value' => 'PRI5', 'label' => 'Primary 5', 'group' => 'Primary School'],
            'PRI6' => ['value' => 'PRI6', 'label' => 'Primary 6', 'group' => 'Primary School'],
            'JSS1' => ['value' => 'JSS1', 'label' => 'JSS 1', 'group' => 'Junior Secondary'],
            'JSS2' => ['value' => 'JSS2', 'label' => 'JSS 2', 'group' => 'Junior Secondary'],
            'JSS3' => ['value' => 'JSS3', 'label' => 'JSS 3', 'group' => 'Junior Secondary'],
            'SS1' => ['value' => 'SS1', 'label' => 'SS 1', 'group' => 'Senior Secondary'],
            'SS2' => ['value' => 'SS2', 'label' => 'SS 2', 'group' => 'Senior Secondary'],
            'SS3' => ['value' => 'SS3', 'label' => 'SS 3', 'group' => 'Senior Secondary'],
        ];

        $normalized = array_map(fn ($g) => strtoupper(str_replace(' ', '', (string) $g)), $allowedGradeLevels);
        $result = [];
        foreach ($normalized as $key) {
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
        return self::gradeOptionsForCategoryIds($this->category_ids);
    }

    public function allowedGradeLevels(): array
    {
        return self::allowedGradeLevelsForCategoryIds($this->category_ids);
    }

    public function supportsGradeLevel(string $gradeLevel): bool
    {
        return in_array(strtoupper(str_replace(' ', '', $gradeLevel)), $this->allowedGradeLevels(), true);
    }

    /**
     * Expand allowed grade levels to include formatted and case variants (e.g. JSS1, JSS 1, jss1).
     */
    public static function gradeLevelVariants(array $allowedGrades): array
    {
        $variants = [];
        foreach ($allowedGrades as $g) {
            $clean = strtoupper(str_replace(' ', '', (string) $g));
            if (! $clean) {
                continue;
            }
            $variants[] = $clean;
            $variants[] = strtolower($clean);
            if (preg_match('/^([A-Z]+)(\d+)$/', $clean, $m)) {
                $variants[] = $m[1].' '.$m[2];
                $variants[] = strtolower($m[1]).' '.$m[2];
                $variants[] = ucfirst(strtolower($m[1])).' '.$m[2];
                $variants[] = ucfirst(strtolower($m[1])).$m[2];
            }
        }

        return array_values(array_unique($variants));
    }

    /**
     * Computed names of assigned categories.
     */
    public function getCategoryNamesAttribute(): array
    {
        $ids = $this->category_ids ?? [];

        $map = [
            1 => 'Primary School',
            2 => 'Junior Secondary',
            3 => 'Senior Secondary',
        ];

        $names = [];
        foreach ($ids as $id) {
            if (isset($map[(int) $id])) {
                $names[] = $map[(int) $id];
            }
        }

        return $names;
    }

    /**
     * User-friendly badge label.
     */
    public function getCategoryTypeLabelAttribute(): string
    {
        $ids = array_map('intval', $this->category_ids ?? []);
        sort($ids);

        if (empty($ids)) {
            return 'All levels';
        }

        if (count($ids) === 1) {
            return match ($ids[0]) {
                1 => 'Primary School',
                2 => 'Junior Secondary',
                3 => 'Senior Secondary',
                default => 'Secondary',
            };
        }

        if ($ids === [1, 2]) {
            return 'Combined (Primary & Junior)';
        }
        if ($ids === [2, 3]) {
            return 'Combined (Junior & Senior)';
        }
        if ($ids === [1, 3]) {
            return 'Combined (Primary & Senior)';
        }
        if ($ids === [1, 2, 3]) {
            return 'Combined (All-Through)';
        }

        return 'Combined';
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
        return $this->hasMany(ClassModel::class, 'school_id');
    }

    public function subjects(): HasMany
    {
        return $this->hasMany(Subject::class, 'school_id');
    }

    public function teachers(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, TeacherProfile::class, 'school_id', 'id', null, 'user_id');
    }

    public function learners(): HasManyThrough
    {
        return $this->hasManyThrough(User::class, LearnerProfile::class, 'school_id', 'id', null, 'user_id');
    }

    /** Schools the user may see in admin screens: all for platform admins, else their own. */
    public function scopeVisibleTo($query, User $user)
    {
        return $user->isPlatformAdmin() ? $query : $query->whereKey($user->managedSchoolId() ?? 0);
    }
}
