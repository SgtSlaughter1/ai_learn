<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class ClassModel extends Model
{
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
}
