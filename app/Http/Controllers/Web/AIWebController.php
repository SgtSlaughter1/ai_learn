<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AIWebController extends Controller
{
    public function __construct(
        protected AIService $aiService
    ) {}

    /**
     * Get an AI tutor explanation for a specific question choice.
     */
    public function explain(Request $request): JsonResponse
    {
        $request->validate([
            'question_id'        => ['required', 'integer', 'exists:questions,id'],
            'selected_option_id' => ['nullable', 'integer', 'exists:question_options,id'],
        ]);

        $question = Question::findOrFail($request->input('question_id'));
        $selectedOptionId = $request->input('selected_option_id');

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
        $baseQuestionId = $request->input('question_id');
        $topicId = $request->input('topic_id');
        $subjectId = $request->input('subject_id');
        $excludeIds = (array) $request->input('exclude_ids', []);

        if ($baseQuestionId) {
            $excludeIds[] = (int) $baseQuestionId;
            $baseQuestion = Question::with('topic.subject')->find($baseQuestionId);
            if ($baseQuestion) {
                $topicId = $topicId ?: $baseQuestion->topic_id;
                $subjectId = $subjectId ?: $baseQuestion->topic?->subject_id;
            }
        }

        $query = Question::with(['options', 'topic.subject']);

        if (!empty($excludeIds)) {
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
        if (!$question && $subjectId && $topicId) {
            $fallbackQuery = Question::with(['options', 'topic.subject'])
                ->whereHas('topic', fn($q) => $q->where('subject_id', $subjectId));
            if (!empty($excludeIds)) {
                $fallbackQuery->whereNotIn('id', array_unique($excludeIds));
            }
            $question = $fallbackQuery->inRandomOrder()->first();
        }

        if (!$question) {
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
                'options' => $question->options->map(fn($o, $idx) => [
                    'id' => $o->id,
                    'label' => chr(65 + $idx),
                    'option_text' => $o->option_text,
                    'is_correct' => (bool) $o->is_correct,
                ]),
            ],
        ]);
    }

    /**
     * Chat with the personal AI companion.
     */
    public function chat(Request $request): JsonResponse
    {
        $request->validate([
            'message' => ['required', 'string'],
            'history' => ['nullable', 'array'],
        ]);

        $user = $request->user() ?? \Illuminate\Support\Facades\Auth::user() ?? \App\Models\User::where('role', 'school_admin')->first() ?? \App\Models\User::first();
        $message = $request->input('message');
        $history = $request->input('history', []);

        $response = $this->aiService->generateChatResponse($user, $message, $history);

        return response()->json([
            'response' => $response,
        ]);
    }
}
