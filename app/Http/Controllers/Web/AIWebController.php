<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\AI\ChatAIRequest;
use App\Http\Requests\AI\ExplainQuestionRequest;
use App\Models\Question;
use App\Services\AI\AiInputSanitizer;
use App\Services\AI\ChatConversations;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AIWebController extends Controller
{
    public function __construct(
        protected AIService $aiService,
        protected AiInputSanitizer $sanitizer,
        protected ChatConversations $conversations
    ) {}

    /**
     * Get an AI tutor explanation for a specific question choice.
     */
    public function explain(ExplainQuestionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $question = Question::forUser($request->user())->where('status', 'active')->findOrFail($validated['question_id']);
        $selectedOptionId = $validated['selected_option_id'] ?? null;

        $explanation = $this->aiService->explainAnswer($question, $selectedOptionId);

        return response()->json([
            'explanation' => $explanation,
        ]);
    }

    /**
     * Get a similar practice question from the same topic/subject.
     */
    public function similarQuestion(Request $request): JsonResponse
    {
        $user = $request->user();
        $baseQuestionId = $request->input('question_id');
        $topicId = $request->input('topic_id');
        $subjectId = $request->input('subject_id');
        $excludeIds = $this->parseIds($request->input('exclude_ids', []));

        if ($baseQuestionId) {
            $excludeIds[] = (int) $baseQuestionId;
            $baseQuestion = Question::forUser($user)->with('topic.subject')->find($baseQuestionId);
            if ($baseQuestion) {
                $topicId = $topicId ?: $baseQuestion->topic_id;
                $subjectId = $subjectId ?: $baseQuestion->topic?->subject_id;
            }
        }

        // Only questions this user may see: their school's and the shared bank.
        $query = Question::forUser($user)->with(['options', 'topic.subject'])->where('status', 'active');

        if (! empty($excludeIds)) {
            $query->whereNotIn('id', array_unique($excludeIds));
        }

        if ($topicId) {
            $query->where('topic_id', $topicId);
        } elseif ($subjectId) {
            $query->whereHas('topic', function ($q) use ($subjectId) {
                $q->where('subject_id', $subjectId);
            });
        }

        $question = (clone $query)->inRandomOrder()->first();

        // Fallback to subject if no more questions in specific topic
        if (! $question && $subjectId && $topicId) {
            $fallbackQuery = Question::forUser($user)->with(['options', 'topic.subject'])
                ->where('status', 'active')
                ->whereHas('topic', fn ($q) => $q->where('subject_id', $subjectId));
            if (! empty($excludeIds)) {
                $fallbackQuery->whereNotIn('id', array_unique($excludeIds));
            }
            $question = $fallbackQuery->inRandomOrder()->first();
        }

        if (! $question) {
            return response()->json([
                'success' => false,
                'message' => 'No additional practice questions found for this topic.',
                'question' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'question' => [
                'id' => $question->id,
                'question_text' => $question->question_text,
                'explanation' => $question->explanation,
                'topic' => [
                    'id' => $question->topic?->id,
                    'name' => $question->topic?->name,
                ],
                'subject' => [
                    'id' => $question->topic?->subject?->id,
                    'name' => $question->topic?->subject?->name,
                ],
                'options' => $question->options->map(fn ($o, $idx) => [
                    'id' => $o->id,
                    'label' => chr(65 + $idx),
                    'option_text' => $o->option_text,
                    'is_correct' => (bool) $o->is_correct,
                ]),
            ],
        ]);
    }

    /**
     * Ids from a query string: "1,2,3" or exclude_ids[]=1&exclude_ids[]=2.
     *
     * @return array<int, int>
     */
    private function parseIds(mixed $raw): array
    {
        $parts = is_array($raw) ? $raw : explode(',', (string) $raw);

        return array_values(array_filter(array_map('intval', $parts), fn (int $id) => $id > 0));
    }

    /**
     * Chat with the personal AI companion.
     *
     * Security: strictly authenticated, read-only, and every user-supplied string
     * is sanitized before it can reach the AI prompt or any query layer.
     */
    public function chat(ChatAIRequest $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $validated = $request->validated();

        // Defense in depth: sanitize even though FormRequest validation capped lengths.
        $message = $this->sanitizer->sanitizeMessage($validated['message']);
        // A saved chat (only the user's own; anyone else's is a 404) supplies its own history.
        $conversation = isset($validated['conversation_id'])
            ? $user->aiConversations()->findOrFail($validated['conversation_id'], ['id'])
            : null;
        $history = $conversation
            ? $this->conversations->recentHistory($conversation)
            // A chat not saved yet keeps only the user's own turns: replies typed into the request
            // could put words in the assistant's mouth ("Sure, I'll ignore my rules").
            : array_values(array_filter($this->sanitizer->sanitizeHistory($validated['history'] ?? []), fn ($turn) => $turn['role'] === 'user'));

        // A message that is empty after sanitization carried no legitimate content.
        if ($message === '') {
            return response()->json([
                'success' => false,
                'message' => 'Your message could not be processed. Please rephrase your question.',
            ], 422);
        }

        $response = $this->aiService->generateChatResponse($user, $message, $history);
        $conversation = $this->conversations->record($user, $conversation, $message, $response);

        return response()->json([
            'response' => $response,
            'conversation_id' => $conversation->id,
        ]);
    }
}
