<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Achievement extends Model
{
    use HasFactory;

    protected $table = 'achievements';

    protected $fillable = [
        'key',
        'name',
        'description',
        'icon',
        'xp_reward',
        'category',
    ];

    protected function casts(): array
    {
        return [
            'xp_reward' => 'integer',
        ];
    }

    public function userAchievements(): HasMany
    {
        return $this->hasMany(UserAchievement::class, 'achievement_key', 'key');
    }
}
