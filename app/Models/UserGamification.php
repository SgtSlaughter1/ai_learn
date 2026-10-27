<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserGamification extends Model
{
    use HasFactory;

    protected $table = 'user_gamification';

    /** Written only by GamificationService. */
    protected $fillable = [
        'user_id', 'total_xp', 'level', 'tier', 'current_streak', 'longest_streak',
        'streak_freeze_count', 'last_active_date', 'last_streak_penalty_at', 'streak_shield_used_at',
    ];

    protected function casts(): array
    {
        return [
            'last_active_date' => 'date',
            'last_streak_penalty_at' => 'date',
            'streak_shield_used_at' => 'date',
            'streak_freeze_count' => 'integer',
            'total_xp' => 'integer',
            'level' => 'integer',
            'current_streak' => 'integer',
            'longest_streak' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
