<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Question;
use App\Models\QuestionContext;
use App\Models\Topic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Shared passages (poems, diagrams, tables) in the question bank. They are created
 * through the question form (QuestionController::placeInContext); these endpoints list
 * them for "Link to an existing passage", edit them, reorder their questions and delete them.
 */
class QuestionContextController extends Controller
{
    /** Passages in a topic the user may add questions to, newest first. */
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate(['topic_id' => ['required', 'integer', 'exists:topics,id']]);
        $topic = Topic::with('subject')->findOrFail($validated['topic_id']);
        Gate::authorize('create', [Question::class, $topic]);

        $user = $request->user();
        $contexts = QuestionContext::where('topic_id', $topic->id)
            ->when(! $user->isPlatformAdmin(), fn ($q) => $q->where('school_id', $user->managedSchoolId()))
            ->withCount(['questions' => fn ($q) => $q->where('status', '!=', 'archived')])
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json(['contexts' => $contexts]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $context = QuestionContext::with('topic.subject')->findOrFail($id);
        Gate::authorize('update', $context);

        $validated = $request->validate([
            'type' => ['sometimes', 'string', Rule::in(QuestionContext::TYPES)],
            'title' => ['nullable', 'string', 'max:255'],
            'instructions' => ['nullable', 'string', 'max:500'],
            'body' => ['nullable', 'string', 'max:60000'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'show_line_numbers' => ['sometimes', 'boolean'],
        ]);
        $body = array_key_exists('body', $validated) ? $validated['body'] : $context->body;
        $image = array_key_exists('image_url', $validated) ? $validated['image_url'] : $context->image_url;
        if (blank($body) && blank($image)) {
            return response()->json([
                'message' => 'Add the passage text or a picture.',
                'errors' => ['body' => ['Add the passage text or a picture.']],
            ], 422);
        }

        $context->update($validated);

        return response()->json(['message' => 'Passage updated', 'context' => $context->fresh()]);
    }

    /** Set the order of a passage's questions: question_ids in the new order. */
    public function reorder(Request $request, int $id): JsonResponse
    {
        $context = QuestionContext::with('topic.subject')->findOrFail($id);
        Gate::authorize('update', $context);

        $validated = $request->validate([
            'question_ids' => ['required', 'array', 'max:200'],
            'question_ids.*' => ['integer'],
        ]);
        $ids = array_values(array_unique($validated['question_ids']));
        $belonging = Question::where('context_id', $context->id)->pluck('id')->all();
        if (array_diff($ids, $belonging)) {
            return response()->json(['message' => 'Those questions are not all on this passage.'], 422);
        }

        DB::transaction(function () use ($ids, $context) {
            foreach ($ids as $position => $questionId) {
                Question::where('id', $questionId)->where('context_id', $context->id)
                    ->update(['context_order' => $position + 1]);
            }
        });

        return response()->json(['message' => 'Order saved']);
    }

    /**
     * Delete a passage. With delete_questions its questions go too (archived when learners
     * have answered them, as with single questions); without it they stay as single questions.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $context = QuestionContext::with('topic.subject')->findOrFail($id);
        Gate::authorize('delete', $context);
        $deleteQuestions = $request->boolean('delete_questions');

        DB::transaction(function () use ($context, $deleteQuestions) {
            foreach ($context->questions()->get() as $question) {
                if (! $deleteQuestions) {
                    $question->update(['context_id' => null, 'context_order' => null]);
                } elseif ($question->answers()->exists()) {
                    $question->update(['status' => 'archived', 'context_id' => null, 'context_order' => null]);
                    $question->quizzes()->detach();
                } else {
                    $question->delete();
                }
            }
            $context->delete();
        });

        return response()->json([
            'message' => $deleteQuestions ? 'Passage and its questions deleted' : 'Passage deleted; its questions are now single questions',
        ]);
    }
}
