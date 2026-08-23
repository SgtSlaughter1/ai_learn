<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property string $user_id
 * @property int $total_xp
 * @property int $level
 * @property string $rank
 * @property int $current_streak
 * @property int $longest_streak
 * @property \Carbon\Carbon|null $last_active_date
 * @property \Carbon\Carbon|null $created_at
 * @property \Carbon\Carbon|null $updated_at
 */
#[Fillable(['user_id', 'total_xp', 'level', 'rank', 'current_streak', 'longest_streak', 'last_active_date'])]
class UserGamification extends Model
{
    use HasFactory;

    protected $table = 'user_gamification';

    protected function casts(): array
    {
        return [
            'last_active_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
