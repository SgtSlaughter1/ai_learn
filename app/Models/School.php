<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class School extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'address',
        'city',
        'state',
        'phone',
        'email',
        'description',
        'admin_user_id',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
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
