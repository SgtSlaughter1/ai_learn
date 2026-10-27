<?php

namespace App\Actions\Quiz;

use DateTimeInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Grades a quiz attempt on the server, whatever the client says: the online submit and the
 * offline sync both use this, so they can't drift apart.
 */
class GradeQuizAttempt
{
    /**
     * @param  Collection  $questions  the questions to grade (Quiz::questionsForAttempt), with options and pivot marks
     * @param  array<int, mixed>  $selected  question id => selected option id, or a list of ids (multiple select)
     * @return array{score: int, total_marks: int, answers: array<int, array<string, mixed>>, topic_tallies: array<int, array{attempted: int, correct: int}>}
     */
    public function handle(Collection $questions, array $selected, string $attemptId, DateTimeInterface $answeredAt): array
    {
        $score = 0;
        $totalMarks = 0;
        $answers = [];
        $tallies = [];

        foreach ($questions as $question) {
            $marks = (int) ($question->pivot->marks ?? 1);
            $totalMarks += $marks;

            [$recordedOptionId, $isCorrect] = $this->gradeOne($question, $selected[$question->id] ?? null);
            $marksAwarded = $isCorrect ? $marks : 0;
            $score += $marksAwarded;

            $answers[] = [
                'id' => (string) Str::uuid(),
                'quiz_attempt_id' => $attemptId,
                'question_id' => $question->id,
                'selected_option_id' => $recordedOptionId,
                'is_correct' => $isCorrect,
                'marks_awarded' => $marksAwarded,
                'answered_at' => $answeredAt,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $tallies[$question->topic_id] ??= ['attempted' => 0, 'correct' => 0];
            $tallies[$question->topic_id]['attempted']++;
            $tallies[$question->topic_id]['correct'] += $isCorrect ? 1 : 0;
        }

        return ['score' => $score, 'total_marks' => $totalMarks, 'answers' => $answers, 'topic_tallies' => $tallies];
    }

    /**
     * Only this question's own option ids count: an id from another question, or one that no longer
     * exists, is recorded as "no answer" rather than as a wrong or dangling foreign key.
     *
     * @return array{0: ?int, 1: bool} the option id to store, and whether the answer is right
     */
    private function gradeOne(object $question, mixed $selected): array
    {
        $validOptionIds = $question->options->pluck('id')->map(fn ($id) => (int) $id);

        if (is_array($selected)) {
            $chosen = collect($selected)->map(fn ($id) => (int) $id)
                ->filter(fn ($id) => $validOptionIds->contains($id))
                ->sort()->values()->all();
            $correct = $question->options->where('is_correct', true)
                ->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();

            return [$chosen[0] ?? null, $correct !== [] && $correct === $chosen];
        }

        $optionId = is_numeric($selected) && $validOptionIds->contains((int) $selected) ? (int) $selected : null;

        return [$optionId, $optionId !== null && (bool) $question->options->firstWhere('id', $optionId)?->is_correct];
    }
}
