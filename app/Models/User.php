<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
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
    use HasFactory, Notifiable, HasUuids;

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
}
