<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One user's AI chat. Only its owner can see it. */
class AiConversation extends Model
{
    use Prunable;

    /** Chats nobody has added to for this many days are deleted (see the privacy policy). */
    public const KEEP_DAYS = 365;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['last_message_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(AiMessage::class);
    }

    public function prunable(): Builder
    {
        return static::where('last_message_at', '<', now()->subDays(self::KEEP_DAYS));
    }
}
