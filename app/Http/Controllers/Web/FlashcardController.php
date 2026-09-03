<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\Subject;
use App\Services\Gamification\GamificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class FlashcardController extends Controller
{
    /**
     * Render the flashcards study shell page.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('Flashcards/Index');
    }

    /**
     * Generate a personalized recall deck of 10 cards.
     */
    public function getDeck(Request $request): JsonResponse
    {
        $user = $request->user();

        // 1. Identify low-mastery topics (mastery_score < 80)
        $weakTopicIds = LearnerProgress::where('user_id', $user->id)
            ->where('mastery_score', '<', 80)
            ->pluck('topic_id')
            ->toArray();

        // 2. Fetch questions from these weak topics
        $questions = Question::with(['options', 'topic.subject'])
            ->where('status', 'active')
            ->whereIn('topic_id', $weakTopicIds)
            ->inRandomOrder()
            ->limit(10)
            ->get();

        // 3. Fallback: if we don't have 10 cards from weak topics, pad with random active questions
        if ($questions->count() < 10) {
            $existingIds = $questions->pluck('id')->toArray();
            $neededCount = 10 - $questions->count();

            $paddingQuestions = Question::with(['options', 'topic.subject'])
                ->where('status', 'active')
                ->whereNotIn('id', $existingIds)
                ->inRandomOrder()
                ->limit($neededCount)
                ->get();

            $questions = $questions->concat($paddingQuestions);
        }

        // 4. Map questions to clean, secure Flashcard structures
        $deck = $questions->map(function ($q) {
            $correctOption = $q->options->firstWhere('is_correct', true);
            return [
                'id' => $q->id,
                'subject_name' => $q->topic->subject->name ?? 'Curriculum',
                'topic_name' => $q->topic->name ?? 'General',
                'question_text' => $q->question_text,
                'correct_answer' => $correctOption?->option_text ?? 'Answer details are defined in options.',
                'explanation' => $q->explanation ?? 'Review the definitions and practice more exercises in this topic.',
            ];
        });

        return response()->json([
            'deck' => $deck,
        ]);
    }

    /**
     * Submit flashcard session completion and calculate/award XP.
     */
    public function complete(Request $request): JsonResponse
    {
        $user = $request->user();
        $ratings = $request->input('ratings', []);
        
        $cardsCount = count($ratings);
        
        // Calculate XP per rating:
        // 'easy' => 2 XP
        // 'good' => 1 XP
        // 'again' => 0 XP
        $xpEarned = 0;
        foreach ($ratings as $rating) {
            $xpEarned += match ($rating) {
                'easy' => 2,
                'good' => 1,
                'again' => 0,
                default => 0,
            };
        }
        
        // Add a flat +5 XP deck completion bonus if they reviewed at least 1 card
        if ($cardsCount > 0) {
            $xpEarned += 5;
        }
        
        $gamificationService = app(GamificationService::class);
        $result = $gamificationService->processFlashcardCompletion($user, $xpEarned, $cardsCount);
        
        return response()->json([
            'success' => true,
            'xp_earned' => $result['xp_earned'],
            'new_level' => $result['new_level'],
            'new_rank' => $result['new_rank'],
            'new_achievements' => $result['new_achievements'],
        ]);
    }
}
