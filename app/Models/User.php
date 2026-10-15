<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;

use App\Enums\UserRole;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    // SoftDeletes = archiving: archived users keep their quiz history but cannot sign in.
    use HasFactory, Notifiable, HasUuids, SoftDeletes;

    protected $guarded = [];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
        ];
    }

    /**
     * Send the password reset notification.
     *
     * @param string $token
     * @return void
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new \App\Notifications\ResetPasswordNotification($token));
    }

    // --- School Relationships ---

    public function teacherProfile(): HasOne
    {
        return $this->hasOne(TeacherProfile::class);
    }

    public function learnerProfile(): HasOne
    {
        return $this->hasOne(LearnerProfile::class);
    }

    public function classMemberships(): HasMany
    {
        return $this->hasMany(ClassMembership::class);
    }

    public function classes(): BelongsToMany
    {
        return $this->belongsToMany(ClassModel::class, 'class_memberships', 'user_id', 'class_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function schools(): HasManyThrough
    {
        return $this->hasManyThrough(School::class, TeacherProfile::class, 'user_id', 'id', null, 'school_id')
            ->union($this->hasManyThrough(School::class, LearnerProfile::class, 'user_id', 'id', null, 'school_id')->getQuery());
    }

    // --- Gamification ---

    public function gamification(): HasOne
    {
        return $this->hasOne(UserGamification::class);
    }

    public function learnerProgress(): HasMany
    {
        return $this->hasMany(LearnerProgress::class);
    }

    public function administeredSchool(): HasOne
    {
        return $this->hasOne(School::class, 'admin_user_id');
    }

    public function isPlatformAdmin(): bool
    {
        return $this->role === UserRole::PLATFORM_ADMIN || $this->role === 'platform_admin';
    }

    public function isSuperAdmin(): bool
    {
        return $this->isPlatformAdmin();
    }

    public function isSchoolAdmin(): bool
    {
        return $this->role === UserRole::SCHOOL_ADMIN || $this->role === 'school_admin';
    }

    public function isAdmin(): bool
    {
        return $this->isPlatformAdmin() || $this->isSchoolAdmin();
    }

    public function isTeacher(): bool
    {
        return $this->role === UserRole::TEACHER || $this->role === 'teacher';
    }

    public function isLearner(): bool
    {
        return $this->role === UserRole::LEARNER || $this->role === 'learner';
    }

    /**
     * Get the primary school for this user (first school found).
     */
    public function primarySchool(): ?School
    {
        if ($this->isPlatformAdmin()) {
            return School::first();
        }
        if ($this->isSchoolAdmin()) {
            return $this->administeredSchool()->first() ?? School::first();
        }
        if ($this->isTeacher()) {
            return $this->teacherProfile()->first()?->school ?? School::first();
        }
        if ($this->isLearner()) {
            return $this->learnerProfile()->first()?->school;
        }
        return null;
    }

    /**
     * Whether this user is attached to a school (profile, roster or administered school).
     * Independent (self-signup) learners have none and are scoped to general-knowledge content.
     */
    public function hasSchoolAccess(): bool
    {
        if ($this->isPlatformAdmin()) {
            return true;
        }
        if ($this->isSchoolAdmin()) {
            return true;
        }
        if ($this->isTeacher()) {
            return (bool) $this->teacherProfile()->first()?->school_id;
        }
        if ($this->isLearner()) {
            return (bool) ($this->learnerProfile()->first()?->school_id
                ?? $this->classes()->where('classes.is_active', true)->first()?->school_id);
        }
        return false;
    }

    /**
     * Get primary enrolled class for this learner.
     */
    public function primaryClass(): ?ClassModel
    {
        return $this->classes()->where('classes.is_active', true)->first();
    }

    /**
     * Get progressive classes window (full program track or section ladder in school).
     */
    public function classProgressionWindow(int $aheadCount = 2): array
    {
        $currentClass = $this->primaryClass();
        if (!$currentClass) {
            return [];
        }

        $gradeOrder = [
            'CRECHE' => 1, 'KG1' => 2, 'KG2' => 3, 'NUR1' => 4, 'NUR2' => 5,
            'PRI1' => 6, 'PRI2' => 7, 'PRI3' => 8, 'PRI4' => 9, 'PRI5' => 10, 'PRI6' => 11,
            'JSS1' => 12, 'JSS2' => 13, 'JSS3' => 14, 'SS1' => 15, 'SS2' => 16, 'SS3' => 17,
        ];

        // 1. Program Track (e.g., SS1-SS3 Science / Business / Humanities)
        if ($currentClass->program_id) {
            return ClassModel::where('school_id', $currentClass->school_id)
                ->where('is_active', true)
                ->where('program_id', $currentClass->program_id)
                ->get()
                ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                ->pluck('id')
                ->all();
        }

        $currentGrade = strtoupper($currentClass->grade_level ?? '');

        // 2. Junior Secondary section (JSS1 - JSS3)
        if (in_array($currentGrade, ['JSS1', 'JSS2', 'JSS3'])) {
            return ClassModel::where('school_id', $currentClass->school_id)
                ->where('is_active', true)
                ->whereIn('grade_level', ['JSS1', 'JSS2', 'JSS3'])
                ->get()
                ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                ->pluck('id')
                ->all();
        }

        // 3. Primary section (PRI1 - PRI6)
        if (in_array($currentGrade, ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'])) {
            return ClassModel::where('school_id', $currentClass->school_id)
                ->where('is_active', true)
                ->whereIn('grade_level', ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'])
                ->get()
                ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                ->pluck('id')
                ->all();
        }

        return ClassModel::where('school_id', $currentClass->school_id)
            ->where('is_active', true)
            ->whereNull('program_id')
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->pluck('id')
            ->all();
    }

    protected ?array $memoizedAllowedGradeLevels = null;
    protected ?array $memoizedGradeOptions = null;

    /**
     * Compute allowed grade levels strictly based on the user's role, school, and assigned classes.
     * Includes in-memory memoization and eager loading awareness for zero N+1 queries.
     */
    public function allowedGradeLevels(): array
    {
        if ($this->memoizedAllowedGradeLevels !== null) {
            return $this->memoizedAllowedGradeLevels;
        }

        if ($this->isPlatformAdmin()) {
            return $this->memoizedAllowedGradeLevels = School::allowedGradeLevelsForCategory(null);
        }

        $school = $this->primarySchool();
        $schoolAllowed = $school ? $school->allowedGradeLevels() : School::allowedGradeLevelsForCategory(null);

        if ($this->isTeacher()) {
            if ($this->relationLoaded('classes')) {
                $teacherClassGrades = $this->classes
                    ->where('is_active', true)
                    ->pluck('grade_level')
                    ->filter()
                    ->map(fn ($g) => strtoupper(str_replace(' ', '', (string) $g)))
                    ->unique()
                    ->values()
                    ->toArray();
            } else {
                $teacherClassGrades = $this->classes()
                    ->where('classes.is_active', true)
                    ->pluck('grade_level')
                    ->filter()
                    ->map(fn ($g) => strtoupper(str_replace(' ', '', (string) $g)))
                    ->unique()
                    ->values()
                    ->toArray();
            }

            if (empty($teacherClassGrades)) {
                return $this->memoizedAllowedGradeLevels = [];
            }

            return $this->memoizedAllowedGradeLevels = array_values(array_intersect($teacherClassGrades, $schoolAllowed));
        }

        if ($this->isSchoolAdmin()) {
            return $this->memoizedAllowedGradeLevels = $schoolAllowed;
        }

        if ($this->isLearner()) {
            $class = $this->primaryClass();
            $grade = $class?->grade_level ? strtoupper(str_replace(' ', '', (string) $class->grade_level)) : null;
            return $this->memoizedAllowedGradeLevels = ($grade ? [$grade] : []);
        }

        return $this->memoizedAllowedGradeLevels = $schoolAllowed;
    }

    /**
     * Compute structured grade options for the user with request-level memoization.
     */
    public function gradeOptions(): array
    {
        if ($this->memoizedGradeOptions !== null) {
            return $this->memoizedGradeOptions;
        }

        return $this->memoizedGradeOptions = School::filterGradeOptions($this->allowedGradeLevels());
    }

    /**
     * Check if user has permission for a specific grade level.
     */
    public function supportsGradeLevel(?string $gradeLevel): bool
    {
        if (!$gradeLevel) {
            return false;
        }
        $normalized = strtoupper(str_replace(' ', '', $gradeLevel));
        return in_array($normalized, $this->allowedGradeLevels(), true);
    }

    /**
     * Check if user can manage a given class.
     */
    public function canManageClass(?int $classId): bool
    {
        if (!$classId) {
            return false;
        }
        if ($this->isPlatformAdmin()) {
            return true;
        }
        if ($this->isSchoolAdmin()) {
            $schoolId = $this->primarySchool()?->id;
            return ClassModel::where('id', $classId)->where('school_id', $schoolId)->exists();
        }
        if ($this->isTeacher()) {
            return $this->classes()->where('classes.id', $classId)->where('classes.is_active', true)->exists();
        }
        return false;
    }

    /**
     * Check if user can manage a given subject.
     */
    public function canManageSubject(?Subject $subject): bool
    {
        if (!$subject) {
            return false;
        }
        if ($this->isPlatformAdmin()) {
            return true;
        }
        if ($this->isSchoolAdmin()) {
            $schoolId = $this->primarySchool()?->id;
            return $subject->school_id === $schoolId || is_null($subject->school_id);
        }
        if ($this->isTeacher()) {
            return $subject->class_id && $this->classes()->where('classes.id', $subject->class_id)->where('classes.is_active', true)->exists();
        }
        return false;
    }

    /**
     * Check if user can manage a given topic.
     */
    public function canManageTopic(?Topic $topic): bool
    {
        if (!$topic) {
            return false;
        }
        if ($this->isPlatformAdmin()) {
            return true;
        }
        $subject = $topic->subject ?? Subject::find($topic->subject_id);
        if (!$this->canManageSubject($subject)) {
            return false;
        }
        if ($topic->level && !$this->supportsGradeLevel($topic->level)) {
            return false;
        }
        return true;
    }
}
