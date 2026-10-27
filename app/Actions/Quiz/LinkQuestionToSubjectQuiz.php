<?php

namespace App\Actions\Quiz;

use App\Models\Question;
use App\Models\Quiz;
use App\Models\Topic;

/**
 * Every question added to the bank also goes into its subject's "Assessment & Practice" quiz
 * (one per subject and school), so learners can take it straight away.
 */
class LinkQuestionToSubjectQuiz
{
    /** The subject quiz for a topic, created on first use; null when the topic has no subject. */
    public function quizFor(?Topic $topic, ?int $schoolId): ?Quiz
    {
        $subjectName = $topic?->subject?->name;
        if ($subjectName === null) {
            return null;
        }

        return Quiz::firstOrCreate(
            ['title' => "{$subjectName} Assessment & Practice", 'school_id' => $schoolId],
            [
                'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                'time_limit_minutes' => 30,
                'status' => 'active',
            ]
        );
    }

    /** Add the question at the end of the quiz, or (already there) update its marks. */
    public function link(Quiz $quiz, Question $question, int $marks): void
    {
        if ($quiz->questions()->where('questions.id', $question->id)->exists()) {
            $quiz->questions()->updateExistingPivot($question->id, ['marks' => $marks]);

            return;
        }

        $quiz->questions()->attach($question->id, [
            'sort_order' => (int) $quiz->questions()->max('quiz_questions.sort_order') + 1,
            'marks' => $marks,
        ]);
    }
}
