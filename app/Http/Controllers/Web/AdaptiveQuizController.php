<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Quiz\AdaptiveQuizAnswerRequest;
use App\Models\Quiz;
use App\Services\Adaptive\AdaptiveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

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
        Gate::authorize('attempt', $quiz);
        $user = $request->user();

        $result = $this->adaptiveService->startQuiz($user->id, $quiz);

        return response()->json($result);
    }

    /**
     * Submit an answer and get the next adaptive question.
     */
    public function answer(AdaptiveQuizAnswerRequest $request, Quiz $quiz): JsonResponse
    {
        Gate::authorize('attempt', $quiz);
        $user = $request->user();
        $validated = $request->validated();

        $result = $this->adaptiveService->submitAnswer(
            $user->id,
            $validated['state_id'],
            $validated['question_id'],
            $validated['selected_option_id'] ?? null,
            $quiz->id,
        );

        return response()->json($result);
    }
}
