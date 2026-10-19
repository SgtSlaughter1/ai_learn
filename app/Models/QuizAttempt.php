<?php

namespace App\Models;

use App\Http\Controllers\Web\DashboardController;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

class QuizAttempt extends Model
{
    use HasFactory, HasUuids;

    protected $guarded = [];

    protected static function booted(): void
    {
        // A new or updated attempt changes the learner's dashboard; don't serve stale stats.
        static::saved(fn (self $attempt) => Cache::forget(DashboardController::LEARNER_STATS_CACHE.$attempt->user_id));
    }

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(QuizAnswer::class);
    }
}
