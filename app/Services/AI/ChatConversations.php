<?php

namespace App\Services\AI;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\User;
use App\Services\AIService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Saves each user's AI chats and gives the AI their recent turns from the saved copy. */
class ChatConversations
{
    /**
     * The latest turns of a saved chat, oldest first, in the shape AIService expects. Read from the
     * server's copy, so a client can't slip invented "earlier replies" into the prompt.
     *
     * @return array<int, array{role: string, content: string}>
     */
    public function recentHistory(AiConversation $conversation): array
    {
        return AiMessage::where('ai_conversation_id', $conversation->id)
            ->orderByDesc('id')
            ->limit(AIService::CHAT_HISTORY_TURNS)
            ->get(['role', 'content'])
            ->reverse()
            ->map(fn (AiMessage $m) => ['role' => $m->role, 'content' => $m->content])
            ->values()
            ->all();
    }

    /** Save the user's message and the reply, starting a new chat when there isn't one yet. */
    public function record(User $user, ?AiConversation $conversation, string $message, string $reply): AiConversation
    {
        return DB::transaction(function () use ($user, $conversation, $message, $reply) {
            $now = now();
            $conversation ??= AiConversation::create([
                'user_id' => $user->id,
                'title' => Str::limit(preg_replace('/\s+/', ' ', $message), 60),
                'last_message_at' => $now,
            ]);

            AiMessage::insert([
                ['ai_conversation_id' => $conversation->id, 'role' => 'user', 'content' => $message, 'created_at' => $now],
                ['ai_conversation_id' => $conversation->id, 'role' => 'model', 'content' => $reply, 'created_at' => $now],
            ]);
            $conversation->update(['last_message_at' => $now]);

            return $conversation;
        });
    }
}
