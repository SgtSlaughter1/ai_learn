<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
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

#[Fillable(['name', 'email', 'password', 'role'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasUuids;

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

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SUPER_ADMIN;
    }

    public function isSchoolAdmin(): bool
    {
        return $this->role === UserRole::SCHOOL_ADMIN || $this->role === UserRole::ADMIN;
    }

    public function isAdmin(): bool
    {
        return $this->isSuperAdmin() || $this->isSchoolAdmin();
    }

    public function isLearner(): bool
    {
        return $this->role === UserRole::LEARNER;
    }

    /**
     * Get the primary school for this user (first school found).
     */
    public function primarySchool()
    {
        if ($this->role === UserRole::SUPER_ADMIN) {
            return School::first();
        }
        if ($this->role === UserRole::ADMIN || $this->role === UserRole::SCHOOL_ADMIN) {
            return $this->administeredSchool()->first() ?? School::first();
        }
        if ($this->role === UserRole::TEACHER) {
            return $this->teacherProfile()->first()?->school;
        }
        if ($this->role === UserRole::LEARNER) {
            return $this->learnerProfile()->first()?->school;
        }
        return null;
    }
}
