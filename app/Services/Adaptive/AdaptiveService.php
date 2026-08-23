<?php

namespace App\Services\Adaptive;

use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizAdaptiveState;
use App\Models\QuizAnswer;
use App\Models\QuizAttempt;
use Illuminate\Support\Str;

class AdaptiveService
{
    /**
     * Difficulty rating values on an Elo-like scale.
     */
    private const DIFFICULTY_RATINGS = [
        'easy'   => 1000,
        'medium' => 1500,
        'hard'   => 2000,
    ];

    /**
     * K-factor controls how much each answer shifts the ability score.
     * Higher = more volatile, lower = more stable.
     */
    private const K_FACTOR = 32;

    /**
     * Maximum questions per adaptive quiz session.
     */
    private const MAX_QUESTIONS = 15;

    /**
     * Start a new adaptive quiz session.
     * Returns the initial state and the first question.
     */
    public function startQuiz(string $userId, Quiz $quiz): array
    {
        // Calculate learner's initial ability from their topic mastery
        $initialAbility = $this->calculateInitialAbility($userId, $quiz);

        // Create quiz attempt record
        $attemptId = (string) Str::uuid();
        QuizAttempt::create([
            'id'             => $attemptId,
            'user_id'        => $userId,
            'quiz_id'        => $quiz->id,
            'status'         => 'in_progress',
            'score'          => 0,
            'total_marks'    => 0,
            'started_at'     => now(),
        ]);

        // Create adaptive state
        $state = QuizAdaptiveState::create([
            'quiz_attempt_id'     => $attemptId,
            'user_id'             => $userId,
            'quiz_id'             => $quiz->id,
            'current_ability'     => $initialAbility,
            'questions_answered'  => 0,
            'correct_count'       => 0,
            'answered_question_ids' => [],
            'answer_results'      => [],
            'is_completed'        => false,
        ]);

        // Select and return the first question
        $firstQuestion = $this->selectNextQuestion($state, $quiz);

        return [
            'state_id'         => $state->id,
            'attempt_id'       => $attemptId,
            'ability_score'    => $initialAbility,
            'difficulty_label' => $this->getDifficultyLabel($initialAbility),
            'questions_answered' => 0,
            'total_questions'  => self::MAX_QUESTIONS,
            'is_completed'     => false,
            'question'         => $firstQuestion ? $this->formatQuestion($firstQuestion) : null,
        ];
    }

    /**
     * Submit an answer and return the next question (or completion).
     */
    public function submitAnswer(string $userId, int|string $stateId, int $questionId, ?int $selectedOptionId): array
    {
        $state = QuizAdaptiveState::where('id', $stateId)
            ->where('user_id', $userId)
            ->where('is_completed', false)
            ->firstOrFail();

        $quiz = Quiz::findOrFail($state->quiz_id);

        // Find the question and evaluate the answer
        $question = Question::with('options')->findOrFail($questionId);
        $correctOption = $question->options->firstWhere('is_correct', true);
        $isCorrect = $selectedOptionId && $correctOption && $selectedOptionId === $correctOption->id;

        // Calculate ability shift using Elo formula
        $questionRating = self::DIFFICULTY_RATINGS[$question->difficulty] ?? self::DIFFICULTY_RATINGS['medium'];
        $newAbility = $this->calculateNewAbility($state->current_ability, $questionRating, $isCorrect);

        // Update the state
        $answeredIds = $state->answered_question_ids ?? [];
        if (!is_array($answeredIds)) $answeredIds = [];
        $answeredIds[] = $questionId;

        $results = $state->answer_results ?? [];
        if (!is_array($results)) $results = [];
        $results[] = [
            'question_id'        => $questionId,
            'selected_option_id' => $selectedOptionId,
            'is_correct'         => $isCorrect,
            'ability_before'     => $state->current_ability,
            'ability_after'      => $newAbility,
            'question_difficulty'=> $question->difficulty,
        ];

        $state->update([
            'current_ability'      => $newAbility,
            'questions_answered'   => $state->questions_answered + 1,
            'correct_count'        => $state->correct_count + ($isCorrect ? 1 : 0),
            'answered_question_ids' => $answeredIds,
            'answer_results'       => $results,
        ]);

        // Check if quiz is complete
        $totalQuestions = min(self::MAX_QUESTIONS, $quiz->questions()->count());
        if ($state->questions_answered >= $totalQuestions) {
            return $this->completeQuiz($state, $quiz);
        }

        // Select the next adaptive question
        $nextQuestion = $this->selectNextQuestion($state, $quiz);

        if (!$nextQuestion) {
            return $this->completeQuiz($state, $quiz);
        }

        return [
            'state_id'         => $state->id,
            'attempt_id'       => $state->quiz_attempt_id,
            'ability_score'    => $newAbility,
            'difficulty_label' => $this->getDifficultyLabel($newAbility),
            'questions_answered' => $state->questions_answered,
            'total_questions'  => $totalQuestions,
            'is_completed'     => false,
            'answer_correct'   => $isCorrect,
            'explanation'      => $question->explanation,
            'correct_option_id'=> $correctOption?->id,
            'question'         => $this->formatQuestion($nextQuestion),
        ];
    }

    /**
     * Calculate initial ability from the learner's topic mastery for this quiz's topics.
     * Falls back to 1500 if no history exists.
     */
    private function calculateInitialAbility(string $userId, Quiz $quiz): int
    {
        $topicIds = $quiz->questions()->pluck('questions.topic_id')->unique();

        if ($topicIds->isEmpty()) {
            return 1500;
        }

        $progress = LearnerProgress::where('user_id', $userId)
            ->whereIn('topic_id', $topicIds)
            ->get();

        if ($progress->isEmpty()) {
            return 1500;
        }

        // Map mastery_score (0-100) to ability scale (800-2200)
        // mastery 0 → ability 800, mastery 50 → ability 1500, mastery 100 → ability 2200
        $avgMastery = $progress->avg('mastery_score');
        return (int) round(800 + ($avgMastery / 100) * 1400);
    }

    /**
     * Elo-like ability update.
     * Expected score = 1 / (1 + 10^((questionRating - ability) / 400))
     * New ability = ability + K * (actualScore - expectedScore)
     */
    private function calculateNewAbility(int $currentAbility, int $questionRating, bool $isCorrect): int
    {
        $expectedScore = 1 / (1 + pow(10, ($questionRating - $currentAbility) / 400));
        $actualScore = $isCorrect ? 1 : 0;
        $newAbility = $currentAbility + self::K_FACTOR * ($actualScore - $expectedScore);

        // Clamp ability to reasonable bounds
        return (int) max(500, min(2500, $newAbility));
    }

    /**
     * Select the next question using a modified UCB1-inspired strategy:
     * - Prefer questions whose difficulty is closest to current ability
     * - Add exploration factor to avoid getting stuck on same difficulty
     * - Never repeat questions already answered
     */
    private function selectNextQuestion(QuizAdaptiveState $state, Quiz $quiz): ?Question
    {
        $answeredIds = $state->answered_question_ids ?? [];
        if (!is_array($answeredIds)) $answeredIds = [];
        $totalAnswered = $state->questions_answered;
        $currentAbility = $state->current_ability;

        // Get all available (unanswered) questions for this quiz
        $availableQuestions = $quiz->questions()
            ->with('options')
            ->where('status', 'active')
            ->whereNotIn('questions.id', $answeredIds)
            ->get();

        if ($availableQuestions->isEmpty()) {
            return null;
        }

        // Score each candidate question
        $scored = $availableQuestions->map(function ($question) use ($currentAbility, $totalAnswered) {
            $questionRating = self::DIFFICULTY_RATINGS[$question->difficulty] ?? self::DIFFICULTY_RATINGS['medium'];

            // Distance penalty: prefer questions close to current ability
            $distance = abs($questionRating - $currentAbility);
            $distanceScore = 1 / (1 + $distance / 400);

            // Exploration bonus: slightly favor less-tested difficulties
            // This prevents the engine from getting stuck in one difficulty band
            $explorationBonus = log($totalAnswered + 2) * 10;

            // Combine scores (distance is primary, exploration is secondary)
            $finalScore = $distanceScore * 100 + $explorationBonus * (mt_rand(80, 120) / 100);

            return [
                'question' => $question,
                'score'    => $finalScore,
            ];
        });

        // Sort by score descending and pick the top one
        $scored = $scored->sortByDesc('score')->values();

        return $scored->first()['question'];
    }

    /**
     * Complete the quiz attempt and return final results.
     */
    private function completeQuiz(QuizAdaptiveState $state, Quiz $quiz): array
    {
        $results = $state->answer_results ?? [];
        $score = 0;
        $totalMarks = 0;

        foreach ($results as $result) {
            $questionMarks = $quiz->questions()
                ->where('questions.id', $result['question_id'])
                ->first()
                ?->pivot
                ->marks ?? 1;

            $totalMarks += $questionMarks;
            if ($result['is_correct']) {
                $score += $questionMarks;
            }
        }

        // Mark state as completed
        $state->update(['is_completed' => true]);

        // Update the quiz attempt with final score
        QuizAttempt::where('id', $state->quiz_attempt_id)->update([
            'status'       => 'completed',
            'score'        => $score,
            'total_marks'  => $totalMarks,
            'completed_at' => now(),
        ]);

        // Save individual quiz answers for the result page
        $answersToInsert = [];
        foreach ($results as $result) {
            $answersToInsert[] = [
                'id'                  => (string) Str::uuid(),
                'quiz_attempt_id'     => $state->quiz_attempt_id,
                'question_id'         => $result['question_id'],
                'selected_option_id'  => $result['selected_option_id'],
                'is_correct'          => $result['is_correct'],
                'marks_awarded'       => $result['is_correct'] ? 1 : 0,
                'answered_at'         => now(),
                'created_at'          => now(),
                'updated_at'          => now(),
            ];
        }
        QuizAnswer::insert($answersToInsert);

        // Update topic mastery
        $this->updateTopicMastery($state);

        return [
            'state_id'           => $state->id,
            'attempt_id'         => $state->quiz_attempt_id,
            'ability_score'      => $state->current_ability,
            'difficulty_label'   => $this->getDifficultyLabel($state->current_ability),
            'questions_answered' => $state->questions_answered,
            'correct_count'      => $state->correct_count,
            'is_completed'       => true,
            'score'              => $score,
            'total_marks'        => $totalMarks,
            'percentage'         => $totalMarks > 0 ? round(($score / $totalMarks) * 100) : 0,
            'ability_history'    => collect($results)->pluck('ability_after')->toArray(),
            'question'           => null,
        ];
    }

    /**
     * Update topic mastery scores based on adaptive quiz results.
     */
    private function updateTopicMastery(QuizAdaptiveState $state): void
    {
        $userId = $state->user_id;
        $results = $state->answer_results ?? [];

        // Group results by question topic
        $topicStats = [];
        foreach ($results as $result) {
            $question = Question::find($result['question_id']);
            if (!$question) continue;

            $topicId = $question->topic_id;
            if (!isset($topicStats[$topicId])) {
                $topicStats[$topicId] = ['attempted' => 0, 'correct' => 0];
            }
            $topicStats[$topicId]['attempted']++;
            if ($result['is_correct']) {
                $topicStats[$topicId]['correct']++;
            }
        }

        foreach ($topicStats as $topicId => $stats) {
            $masteryScore = $stats['attempted'] > 0
                ? (int) round(($stats['correct'] / $stats['attempted']) * 100)
                : 0;

            // Get existing progress or calculate from scratch
            $existing = LearnerProgress::where('user_id', $userId)
                ->where('topic_id', $topicId)
                ->first();

            $totalAttempted = ($existing?->questions_attempted ?? 0) + $stats['attempted'];
            $totalCorrect = ($existing?->questions_correct ?? 0) + $stats['correct'];
            $overallMastery = $totalAttempted > 0
                ? (int) round(($totalCorrect / $totalAttempted) * 100)
                : $masteryScore;

            LearnerProgress::updateOrCreate(
                ['user_id' => $userId, 'topic_id' => $topicId],
                [
                    'questions_attempted' => $totalAttempted,
                    'questions_correct'   => $totalCorrect,
                    'mastery_score'       => $overallMastery,
                    'ability_score'       => $state->current_ability,
                    'last_attempted_at'   => now(),
                ]
            );
        }
    }

    /**
     * Map ability score to human-readable difficulty label.
     */
    private function getDifficultyLabel(int $ability): string
    {
        if ($ability < 1200) return 'Beginner';
        if ($ability < 1500) return 'Developing';
        if ($ability < 1800) return 'Proficient';
        if ($ability < 2100) return 'Advanced';
        return 'Expert';
    }

    /**
     * Format a question for API response (strips correct answers).
     */
    private function formatQuestion(Question $question): array
    {
        return [
            'id'            => $question->id,
            'topic_id'      => $question->topic_id,
            'question_text' => $question->question_text,
            'type'          => $question->type,
            'difficulty'    => $question->difficulty,
            'options'       => $question->options->map(fn($o) => [
                'id'          => $o->id,
                'option_text' => $o->option_text,
            ]),
        ];
    }
}
