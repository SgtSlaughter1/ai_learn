<?php

namespace App\Jobs;

use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\SchoolExamAttempt;
use App\Models\SchoolExamQuestion;
use App\Models\User;
use App\Services\SpacedRepetition\SpacedRepetitionService;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Collection;

/**
 * Once a school exam's results are released, each learner's missed questions join their
 * daily review. Off the request path because a whole year group can sit one exam. Safe to
 * run again: review items are unique per learner and question.
 */
class RecordSchoolExamReview implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    /** @var array<int, int> seconds between retries */
    public array $backoff = [30, 120];

    public function __construct(public int $examId)
    {
        $this->afterCommit();
    }

    public function uniqueId(): string
    {
        return (string) $this->examId;
    }

    public function handle(SpacedRepetitionService $spacedRepetition): void
    {
        $questionIds = SchoolExamQuestion::where('school_exam_id', $this->examId)->whereNotNull('question_id')->pluck('question_id', 'id');
        $correct = QuestionOption::whereIn('question_id', $questionIds)->where('is_correct', true)->pluck('id', 'question_id');
        // Passed along so the review service doesn't look each question up again.
        $topics = Question::join('topics', 'topics.id', '=', 'questions.topic_id')
            ->whereIn('questions.id', $questionIds)
            ->get(['questions.id', 'questions.topic_id', 'topics.subject_id'])
            ->keyBy('id');

        SchoolExamAttempt::where('school_exam_id', $this->examId)
            ->where('status', '!=', SchoolExamAttempt::STATUS_IN_PROGRESS)
            ->select(['id', 'user_id', 'answers'])
            ->chunkById(100, function (Collection $attempts) use ($questionIds, $correct, $topics, $spacedRepetition) {
                $users = User::whereIn('id', $attempts->pluck('user_id'))->get()->keyBy('id');
                foreach ($attempts as $attempt) {
                    $user = $users[$attempt->user_id] ?? null;
                    $answers = $attempt->answers ?? [];
                    foreach ($questionIds as $examQuestionId => $questionId) {
                        $selected = $answers[(string) $examQuestionId] ?? null;
                        if ($user && (int) $selected !== (int) ($correct[$questionId] ?? 0)) {
                            $spacedRepetition->recordAttempt($user, [
                                'question_id' => $questionId,
                                'topic_id' => $topics[$questionId]->topic_id ?? null,
                                'subject_id' => $topics[$questionId]->subject_id ?? null,
                                'is_correct' => false,
                            ]);
                        }
                    }
                }
            });
    }
}
