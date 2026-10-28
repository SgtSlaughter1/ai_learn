<?php

namespace App\Services\SchoolExams;

use App\Jobs\RecordSchoolExamReview;
use App\Models\Question;
use App\Models\QuestionContext;
use App\Models\QuestionOption;
use App\Models\SchoolExam;
use App\Models\SchoolExamAttempt;
use App\Models\SchoolExamQuestion;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * School CBT: builds each learner's paper, keeps answers, and marks attempts. Marking happens
 * here only; the correct options never leave the server while an exam can still be sat.
 */
class SchoolExamService
{
    /**
     * Replace the exam's questions, in the given order.
     *
     * @param  array<int, array{id: int, marks?: int|null}>  $questions
     */
    public function syncQuestions(SchoolExam $exam, array $questions, User $actor): void
    {
        $ids = collect($questions)->pluck('id')->map(fn ($id) => (int) $id)->unique()->values();

        // Only questions this person may use, from this school's bank (or shared), of a type the exam screen can mark.
        $allowed = Question::forUser($actor)
            ->whereIn('questions.id', $ids)
            ->where('status', 'active')
            ->whereIn('type', SchoolExam::QUESTION_TYPES)
            ->where(fn ($q) => $q->where('school_id', $exam->school_id)->orWhereNull('school_id'))
            ->pluck('marks', 'questions.id');

        $missing = $ids->reject(fn ($id) => $allowed->has($id));
        if ($missing->isNotEmpty()) {
            throw ValidationException::withMessages([
                'questions' => 'Some questions can\'t be used: they may be inactive, from another school, or a type the exam can\'t mark (only multiple choice and true/false).',
            ]);
        }

        $now = now();
        $rows = collect($questions)->unique('id')->values()->map(fn ($q, $index) => [
            'school_exam_id' => $exam->id,
            'question_id' => (int) $q['id'],
            'position' => $index + 1,
            'marks' => max(1, (int) ($q['marks'] ?? $allowed[(int) $q['id']] ?? 1)),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::transaction(function () use ($exam, $rows) {
            SchoolExamQuestion::where('school_exam_id', $exam->id)->delete();
            foreach ($rows->chunk(200) as $chunk) {
                SchoolExamQuestion::insert($chunk->all());
            }
            $exam->update(['question_count' => $rows->count(), 'total_marks' => $rows->sum('marks')]);
        });
    }

    /** The learner's attempt, created on first start. Starting again returns the same attempt. */
    public function start(SchoolExam $exam, User $learner): SchoolExamAttempt
    {
        $existing = SchoolExamAttempt::where('school_exam_id', $exam->id)->where('user_id', $learner->id)->first();
        if ($existing) {
            return $existing;
        }

        $startedAt = now();
        $deadline = $startedAt->copy()->addMinutes($exam->duration_minutes);
        if ($deadline->gt($exam->closes_at)) {
            $deadline = $exam->closes_at->copy();
        }

        // createOrFirst rides the unique (exam, user) index, so two taps on Start make one attempt.
        return SchoolExamAttempt::createOrFirst(
            ['school_exam_id' => $exam->id, 'user_id' => $learner->id],
            [
                'status' => SchoolExamAttempt::STATUS_IN_PROGRESS,
                'paper' => $this->buildPaper($exam),
                'answers' => [],
                'started_at' => $startedAt,
                'deadline_at' => $deadline,
                'max_score' => $exam->total_marks,
            ],
        );
    }

    /**
     * Question order and option order for one learner. Questions on the same passage stay
     * together in their passage order; the passages and lone questions are shuffled as blocks.
     *
     * @return array{q: array<int, int>, o: array<string, array<int, int>>}
     */
    public function buildPaper(SchoolExam $exam): array
    {
        $rows = SchoolExamQuestion::query()
            ->join('questions', 'questions.id', '=', 'school_exam_questions.question_id')
            ->where('school_exam_id', $exam->id)
            ->orderBy('position')
            ->get(['school_exam_questions.id', 'school_exam_questions.question_id', 'questions.context_id', 'questions.context_order']);

        $blocks = $rows->groupBy(fn ($row) => $row->context_id ? 'c'.$row->context_id : 'q'.$row->id)
            ->map(fn (Collection $block) => $block->sortBy('context_order')->pluck('id')->all())
            ->values();
        if ($exam->shuffle_questions) {
            $blocks = $blocks->shuffle();
        }

        $options = QuestionOption::whereIn('question_id', $rows->pluck('question_id'))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'question_id'])
            ->groupBy('question_id');

        $optionOrder = [];
        foreach ($rows as $row) {
            $ids = ($options[$row->question_id] ?? collect())->pluck('id');
            $optionOrder[(string) $row->id] = ($exam->shuffle_options ? $ids->shuffle() : $ids)->values()->all();
        }

        return ['q' => $blocks->flatten()->map(fn ($id) => (int) $id)->all(), 'o' => $optionOrder];
    }

    /** The questions as this learner sees them: text and options only, never which option is right. */
    public function paperForLearner(SchoolExamAttempt $attempt): array
    {
        $paper = $attempt->paper;
        $examQuestions = SchoolExamQuestion::whereIn('id', $paper['q'])->get(['id', 'question_id', 'marks'])->keyBy('id');
        $questions = Question::whereIn('id', $examQuestions->pluck('question_id')->filter())
            ->get(['id', 'context_id', 'question_text', 'image_url', 'type'])
            ->keyBy('id');
        $options = QuestionOption::whereIn('question_id', $questions->keys())->get(['id', 'option_text'])->keyBy('id');

        $items = [];
        foreach ($paper['q'] as $examQuestionId) {
            $examQuestion = $examQuestions[$examQuestionId] ?? null;
            $question = $examQuestion ? $questions[$examQuestion->question_id] ?? null : null;
            if (! $question) {
                continue; // deleted from the bank after the exam started
            }

            $items[] = [
                'id' => $examQuestionId,
                'context_id' => $question->context_id,
                'question_text' => $question->question_text,
                'image_url' => $question->image_url,
                'type' => $question->type,
                'marks' => $examQuestion->marks,
                'options' => collect($paper['o'][(string) $examQuestionId] ?? [])
                    ->map(fn ($optionId) => $options[$optionId] ?? null)
                    ->filter()
                    ->map(fn ($option) => ['id' => $option->id, 'option_text' => $option->option_text])
                    ->values()
                    ->all(),
            ];
        }

        return [
            'questions' => $items,
            'contexts' => QuestionContext::learnerArrays($questions->pluck('context_id')),
        ];
    }

    /**
     * Store the learner's answers (the whole set, so a lost autosave is repaired by the next).
     *
     * @param  array<string|int, int|null>  $answers  school_exam_question id => option id
     */
    public function saveAnswers(SchoolExamAttempt $attempt, array $answers, int $leftScreenCount): void
    {
        $paper = $attempt->paper;
        $clean = [];
        foreach ($answers as $examQuestionId => $optionId) {
            $allowedOptions = $paper['o'][(string) $examQuestionId] ?? null;
            if ($allowedOptions !== null && $optionId !== null && in_array((int) $optionId, $allowedOptions, true)) {
                $clean[(string) $examQuestionId] = (int) $optionId;
            }
        }

        // Guarded on status, so an answer racing the invigilator's "end" never reopens the attempt.
        SchoolExamAttempt::whereKey($attempt->id)
            ->where('status', SchoolExamAttempt::STATUS_IN_PROGRESS)
            ->update([
                'answers' => json_encode($clean, JSON_FORCE_OBJECT),
                'answered_count' => count($clean),
                'left_screen_count' => max((int) $attempt->left_screen_count, min($leftScreenCount, 65535)),
                'updated_at' => now(),
            ]);
    }

    /** Close the attempt and mark it. Safe to call twice: only an in-progress attempt is closed. */
    public function finish(SchoolExamAttempt $attempt, string $status): SchoolExamAttempt
    {
        $closed = SchoolExamAttempt::whereKey($attempt->id)
            ->where('status', SchoolExamAttempt::STATUS_IN_PROGRESS)
            ->update(['status' => $status, 'submitted_at' => now(), 'updated_at' => now()]);

        $attempt->refresh();
        if ($closed) {
            $this->mark($attempt);
        }

        return $attempt;
    }

    /** Close and mark every attempt on this exam whose time has run out. */
    public function closeOverdue(SchoolExam $exam): void
    {
        SchoolExamAttempt::where('school_exam_id', $exam->id)
            ->overdue()
            ->select(['id', 'school_exam_id', 'status', 'paper', 'answers', 'deadline_at'])
            ->chunkById(100, function (Collection $attempts) {
                foreach ($attempts as $attempt) {
                    $this->finish($attempt, SchoolExamAttempt::STATUS_AUTO_SUBMITTED);
                }
            });
    }

    public function mark(SchoolExamAttempt $attempt): void
    {
        $examQuestions = SchoolExamQuestion::where('school_exam_id', $attempt->school_exam_id)
            ->whereNotNull('question_id')
            ->get(['id', 'question_id', 'marks']);
        $correct = QuestionOption::whereIn('question_id', $examQuestions->pluck('question_id'))
            ->where('is_correct', true)
            ->pluck('id', 'question_id');
        $topicIds = Question::whereIn('id', $examQuestions->pluck('question_id'))->pluck('topic_id', 'id');
        $topicNames = Topic::whereIn('id', $topicIds->unique())->pluck('name', 'id');

        $answers = $attempt->answers ?? [];
        $score = 0;
        $maxScore = 0;
        $topics = [];
        foreach ($examQuestions as $examQuestion) {
            $isCorrect = isset($answers[(string) $examQuestion->id])
                && (int) $answers[(string) $examQuestion->id] === (int) ($correct[$examQuestion->question_id] ?? 0);
            $maxScore += $examQuestion->marks;
            $score += $isCorrect ? $examQuestion->marks : 0;

            $topicId = (int) ($topicIds[$examQuestion->question_id] ?? 0);
            // Questions for the "got 3 of 5 right" line; marks for the topic's score, so topics add up to the total.
            $topics[$topicId] ??= ['topic_id' => $topicId, 'name' => $topicNames[$topicId] ?? 'Other', 'correct' => 0, 'total' => 0, 'marks' => 0, 'max_marks' => 0];
            $topics[$topicId]['total']++;
            $topics[$topicId]['correct'] += $isCorrect ? 1 : 0;
            $topics[$topicId]['max_marks'] += $examQuestion->marks;
            $topics[$topicId]['marks'] += $isCorrect ? $examQuestion->marks : 0;
        }

        $attempt->update([
            'score' => $score,
            'max_score' => $maxScore,
            'percentage' => $maxScore > 0 ? round($score / $maxScore * 100, 2) : 0,
            'topic_breakdown' => array_values($topics),
        ]);
    }

    /** Release results: learners see their corrections and their misses join the daily review. */
    public function releaseResults(SchoolExam $exam): void
    {
        $this->closeOverdue($exam);
        $exam->update(['results_released_at' => now()]);
        RecordSchoolExamReview::dispatch($exam->id);
    }

    /** Per-question review for a learner, only once results are released. */
    public function reviewForLearner(SchoolExamAttempt $attempt): array
    {
        $paper = $this->paperForLearner($attempt);
        $examQuestions = SchoolExamQuestion::whereIn('id', $attempt->paper['q'])->pluck('question_id', 'id');
        $correct = QuestionOption::whereIn('question_id', $examQuestions->filter())->where('is_correct', true)->pluck('id', 'question_id');
        $explanations = Question::whereIn('id', $examQuestions->filter())->pluck('explanation', 'id');
        $answers = $attempt->answers ?? [];

        $paper['questions'] = array_map(function (array $item) use ($examQuestions, $correct, $explanations, $answers) {
            $questionId = $examQuestions[$item['id']] ?? null;

            return $item + [
                'selected_option_id' => $answers[(string) $item['id']] ?? null,
                'correct_option_id' => $correct[$questionId] ?? null,
                'explanation' => $explanations[$questionId] ?? null,
            ];
        }, $paper['questions']);

        return $paper;
    }
}
