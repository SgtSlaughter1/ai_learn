<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassModel extends Model
{
    protected $table = 'classes';

    protected $fillable = [
        'school_id',
        'name',
        'slug',
        'grade_level',
        'section',
        'description',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function school(): BelongsTo
    {
        return $this->belongsTo(School::class);
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

    public function teacherUsers(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(User::class, ClassMembership::class, 'class_id', 'id', 'id', 'user_id')
            ->where('class_memberships.role', 'teacher');
    }

    public function learnerUsers(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(User::class, ClassMembership::class, 'class_id', 'id', 'id', 'user_id')
            ->where('class_memberships.role', 'learner');
    }
}
