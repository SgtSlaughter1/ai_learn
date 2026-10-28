<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\SchoolExam\SaveSchoolExamAnswersRequest;
use App\Http\Requests\SchoolExam\StartSchoolExamRequest;
use App\Models\SchoolExam;
use App\Models\SchoolExamAttempt;
use App\Services\SchoolExams\SchoolExamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * School CBT, learner side: the exams set for their classes, sitting one with the
 * invigilator's start code, and seeing the result. Staff use SchoolExamController.
 */
class LearnerExamController extends Controller
{
    public function __construct(private SchoolExamService $exams) {}

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if (! $user->isLearner()) {
            return redirect('/school-exams');
        }

        $this->closeOwnOverdue($request);

        $exams = $user->cbtEnabled() ? SchoolExam::forLearner($user)
            ->select(['id', 'subject_id', 'title', 'duration_minutes', 'opens_at', 'closes_at', 'status', 'question_count', 'total_marks', 'show_score_immediately', 'results_released_at'])
            ->with([
                'subject:id,name',
                'attempts' => fn ($q) => $q->where('user_id', $user->id)->select(['id', 'school_exam_id', 'status', 'percentage']),
            ])
            // Open and upcoming first, then the most recent finished ones.
            ->orderByRaw('CASE WHEN closes_at >= ? THEN 0 ELSE 1 END', [now()])
            ->orderBy('opens_at')
            ->limit(50)
            ->get()
            ->map(function (SchoolExam $exam) {
                $attempt = $exam->attempts->first();
                $scoreVisible = $attempt && ! $attempt->isInProgress() && ($exam->show_score_immediately || $exam->resultsReleased());

                return [
                    'id' => $exam->id,
                    'title' => $exam->title,
                    'subject' => $exam->subject?->name,
                    'duration_minutes' => $exam->duration_minutes,
                    'opens_at' => $exam->opens_at->toIso8601String(),
                    'closes_at' => $exam->closes_at->toIso8601String(),
                    'question_count' => $exam->question_count,
                    'is_open' => $exam->isOpen(),
                    'attempt_status' => $attempt?->status,
                    'percentage' => $scoreVisible ? $attempt->percentage : null,
                    'results_released' => $exam->resultsReleased(),
                ];
            }) : collect();

        return Inertia::render('Exams/Index', ['exams' => $exams, 'cbtEnabled' => $user->cbtEnabled()]);
    }

    /** The exam screen. The paper itself is fetched by the page, after the start code. */
    public function take(Request $request, SchoolExam $exam): Response|RedirectResponse
    {
        Gate::authorize('take', $exam);
        $attempt = $this->attemptFor($request, $exam);
        if ($attempt && ! $attempt->isInProgress()) {
            return redirect("/exams/{$exam->id}/result");
        }

        return Inertia::render('Exams/Take', ['exam' => $this->examHeader($exam)]);
    }

    public function start(StartSchoolExamRequest $request, SchoolExam $exam): JsonResponse
    {
        Gate::authorize('take', $exam);

        // Someone who already started (and reloaded) carries on without the code.
        $attempt = $this->attemptFor($request, $exam);
        if (! $attempt) {
            abort_unless($exam->isOpen(), 422, $exam->opens_at->isFuture() ? 'This exam has not opened yet.' : 'This exam has closed.');
            abort_unless(hash_equals((string) $exam->access_code, strtoupper(trim($request->validated('access_code')))), 422, 'That start code is not right. Check it with your invigilator.');
            $attempt = $this->exams->start($exam, $request->user());
        }

        return $this->sheet($attempt);
    }

    /** Resume after a reload: the paper, the answers so far and the time left. */
    public function attempt(Request $request, SchoolExam $exam): JsonResponse
    {
        Gate::authorize('take', $exam);
        $attempt = $this->attemptFor($request, $exam);
        abort_unless($attempt, 404, 'Enter the start code to begin.');

        return $this->sheet($attempt);
    }

    public function saveAnswers(SaveSchoolExamAnswersRequest $request, SchoolExam $exam): JsonResponse
    {
        $attempt = $this->attemptFor($request, $exam);
        abort_unless($attempt, 404, 'Start the exam first.');
        if (! $attempt->acceptsAnswers()) {
            $this->exams->finish($attempt, SchoolExamAttempt::STATUS_AUTO_SUBMITTED);

            return response()->json(['status' => $attempt->fresh()->status, 'message' => 'Time is up. Your answers were submitted.'], 409);
        }

        $this->exams->saveAnswers($attempt, $request->validated('answers'), (int) $request->validated('left_screen_count', 0));

        return response()->json(['status' => SchoolExamAttempt::STATUS_IN_PROGRESS, 'seconds_left' => $attempt->secondsLeft()]);
    }

    /** Submit: the final answer sheet comes with it, so nothing in flight is lost. */
    public function submit(SaveSchoolExamAnswersRequest $request, SchoolExam $exam): JsonResponse
    {
        $attempt = $this->attemptFor($request, $exam);
        abort_unless($attempt, 404, 'Start the exam first.');

        if ($attempt->acceptsAnswers()) {
            $this->exams->saveAnswers($attempt, $request->validated('answers'), (int) $request->validated('left_screen_count', 0));
            $attempt->refresh();
        }
        $status = $attempt->acceptsAnswers() ? SchoolExamAttempt::STATUS_SUBMITTED : SchoolExamAttempt::STATUS_AUTO_SUBMITTED;
        $this->exams->finish($attempt, $status);

        return response()->json(['message' => 'Submitted.', 'redirect' => "/exams/{$exam->id}/result"]);
    }

    public function result(Request $request, SchoolExam $exam): Response|RedirectResponse
    {
        Gate::authorize('take', $exam);
        $attempt = $this->attemptFor($request, $exam);
        if (! $attempt) {
            return redirect('/exams');
        }
        if ($attempt->isInProgress()) {
            if ($attempt->acceptsAnswers()) {
                return redirect("/exams/{$exam->id}/take");
            }
            $attempt = $this->exams->finish($attempt, SchoolExamAttempt::STATUS_AUTO_SUBMITTED);
        }

        $scoreVisible = $exam->show_score_immediately || $exam->resultsReleased();

        return Inertia::render('Exams/Result', [
            'exam' => $this->examHeader($exam) + ['pass_mark' => $exam->pass_mark, 'results_released' => $exam->resultsReleased()],
            'attempt' => [
                'status' => $attempt->status,
                'submitted_at' => $attempt->submitted_at?->toIso8601String(),
                'answered_count' => $attempt->answered_count,
                'score' => $scoreVisible ? $attempt->score : null,
                'max_score' => $scoreVisible ? $attempt->max_score : null,
                'percentage' => $scoreVisible ? $attempt->percentage : null,
                'correct_count' => $scoreVisible ? collect($attempt->topic_breakdown ?? [])->sum('correct') : null,
                'topic_breakdown' => $exam->resultsReleased() ? $attempt->topic_breakdown : null,
            ],
            // Corrections only after release, so nobody passes answers to classmates still writing.
            'review' => $exam->resultsReleased() ? $this->exams->reviewForLearner($attempt) : null,
        ]);
    }

    private function sheet(SchoolExamAttempt $attempt): JsonResponse
    {
        if (! $attempt->acceptsAnswers()) {
            $this->exams->finish($attempt, SchoolExamAttempt::STATUS_AUTO_SUBMITTED);

            return response()->json(['status' => $attempt->fresh()->status, 'redirect' => "/exams/{$attempt->school_exam_id}/result"], 409);
        }

        return response()->json([
            'status' => $attempt->status,
            'seconds_left' => $attempt->secondsLeft(),
            'answers' => (object) ($attempt->answers ?? []),
            'left_screen_count' => $attempt->left_screen_count,
        ] + $this->exams->paperForLearner($attempt));
    }

    private function attemptFor(Request $request, SchoolExam $exam): ?SchoolExamAttempt
    {
        return SchoolExamAttempt::where('school_exam_id', $exam->id)->where('user_id', $request->user()->id)->first();
    }

    /** Close this learner's attempts whose time ran out while they were away. */
    private function closeOwnOverdue(Request $request): void
    {
        SchoolExamAttempt::where('user_id', $request->user()->id)
            ->overdue()
            ->get(['id'])
            ->each(fn (SchoolExamAttempt $attempt) => $this->exams->finish($attempt, SchoolExamAttempt::STATUS_AUTO_SUBMITTED));
    }

    private function examHeader(SchoolExam $exam): array
    {
        $exam->loadMissing('subject:id,name');

        return [
            'id' => $exam->id,
            'title' => $exam->title,
            'subject' => $exam->subject?->name,
            'instructions' => $exam->instructions,
            'duration_minutes' => $exam->duration_minutes,
            'question_count' => $exam->question_count,
            'total_marks' => $exam->total_marks,
            'opens_at' => $exam->opens_at->toIso8601String(),
            'closes_at' => $exam->closes_at->toIso8601String(),
            'is_open' => $exam->isOpen(),
        ];
    }
}
