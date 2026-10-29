<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\AiMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A user's own saved AI chats: list, open, delete. Nobody else's chats are reachable. */
class AiConversationController extends Controller
{
    /** The most recent chats in the history list. */
    private const LIST_SIZE = 30;

    /** Messages shown when a chat is opened, newest kept. */
    private const MESSAGES_SHOWN = 200;

    public function index(Request $request): JsonResponse
    {
        $conversations = $request->user()->aiConversations()
            ->orderByDesc('last_message_at')
            ->limit(self::LIST_SIZE)
            ->get(['id', 'title', 'last_message_at']);

        return response()->json(['data' => $conversations]);
    }

    public function show(Request $request, int $conversation): JsonResponse
    {
        $conversation = $request->user()->aiConversations()->findOrFail($conversation, ['id', 'title']);
        $messages = AiMessage::where('ai_conversation_id', $conversation->id)
            ->orderByDesc('id')
            ->limit(self::MESSAGES_SHOWN)
            ->get(['role', 'content', 'created_at'])
            ->reverse()
            ->values();

        return response()->json(['id' => $conversation->id, 'title' => $conversation->title, 'messages' => $messages]);
    }

    public function destroy(Request $request, int $conversation): JsonResponse
    {
        $request->user()->aiConversations()->findOrFail($conversation, ['id'])->delete();

        return response()->json(['deleted' => true]);
    }
}
