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
