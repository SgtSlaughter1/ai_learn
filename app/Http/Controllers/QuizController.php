<?php

namespace App\Http\Controllers;

use App\Http\Resources\QuestionResource;
use App\Models\Quiz;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class QuizController extends Controller
{
    public function show(Request $request, Quiz $quiz): JsonResponse
    {
        // Authorize user access to the quiz using model policies
        Gate::authorize('view', $quiz);

        // Eager load questions and options to prevent N+1 queries, selecting required columns
        $quiz->load([
            'questions' => function ($query) {
                $query->select(['questions.id', 'topic_id', 'question_text', 'type', 'difficulty'])
                      ->where('status', 'active');
            },
            'questions.options' => function ($query) {
                $query->select(['question_options.id', 'question_id', 'option_text', 'sort_order']);
            }
        ]);

        return response()->json([
            'id' => $quiz->id,
            'title' => $quiz->title,
            'description' => $quiz->description,
            'time_limit_minutes' => $quiz->time_limit_minutes,
            // QuestionResource handles hiding correct answers and explanations
            'questions' => QuestionResource::collection($quiz->questions),
        ]);
    }
}
