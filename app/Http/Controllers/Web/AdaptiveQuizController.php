<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Quiz;
use App\Services\Adaptive\AdaptiveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdaptiveQuizController extends Controller
{
    public function __construct(
        private AdaptiveService $adaptiveService
    ) {}

    /**
     * Start a new adaptive quiz session.
     * Returns the first question based on the learner's estimated ability.
     */
    public function start(Request $request, Quiz $quiz): JsonResponse
    {
        $user = $request->user();

        $result = $this->adaptiveService->startQuiz($user->id, $quiz);

        return response()->json($result);
    }

    /**
     * Submit an answer and get the next adaptive question.
     */
    public function answer(Request $request, Quiz $quiz): JsonResponse
    {
        $request->validate([
            'state_id'         => ['required'],
            'question_id'      => ['required', 'integer'],
            'selected_option_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();

        $result = $this->adaptiveService->submitAnswer(
            $user->id,
            $request->input('state_id'),
            $request->input('question_id'),
            $request->input('selected_option_id'),
        );

        return response()->json($result);
    }
}
