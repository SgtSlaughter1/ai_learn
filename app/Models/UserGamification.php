<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserGamification extends Model
{
    use HasFactory;

    protected $table = 'user_gamification';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'last_active_date'        => 'date',
            'last_streak_penalty_at'  => 'date',
            'streak_shield_used_at'   => 'date',
            'streak_freeze_count'     => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
