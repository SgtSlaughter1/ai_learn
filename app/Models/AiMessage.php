<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One turn of an AI chat: the user's message or the reply. */
class AiMessage extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AiConversation::class, 'ai_conversation_id');
    }
}
