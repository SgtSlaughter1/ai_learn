<?php

namespace App\Http\Controllers\Web;

use App\Actions\Quiz\GradeQuizAttempt;
use App\Http\Controllers\Controller;
use App\Http\Requests\Quiz\SubmitQuizAttemptRequest;
use App\Http\Requests\Quiz\SyncQuizAttemptRequest;
use App\Jobs\AwardQuizCompletionXp;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuestionContext;
use App\Models\Quiz;
use App\Models\QuizAnswer;
use App\Models\QuizAttempt;
use App\Services\Gamification\GamificationService;
use App\Services\SpacedRepetition\SpacedRepetitionService;
use App\Support\AttemptQuestions;
use App\Support\OfflineAnswerKey;
use App\Support\OptionOrder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class QuizWebController extends Controller
{
    public function __construct(
        private GradeQuizAttempt $grader,
        private GamificationService $gamification,
        private SpacedRepetitionService $spacedRepetition,
    ) {}

    /**
     * Render the student quiz taking interface.
     */
    public function showQuiz(Request $request, Quiz $quiz): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user?->isAnyAdmin()) {
            return redirect('/admin/dashboard');
        }
        Gate::authorize('view', $quiz);

        return Inertia::render('quizzes/Show', [
            'quizId' => $quiz->id,
        ]);
    }

    public function getQuizData(Request $request, Quiz $quiz): JsonResponse
    {
        Gate::authorize('view', $quiz);

        // Eager load questions and options (including explanation and is_correct for offline caching)
        $quiz->load([
            'questions' => function ($query) {
                $query->select(['questions.id', 'topic_id', 'context_id', 'context_order', 'question_text', 'image_url', 'type', 'difficulty', 'explanation'])
                    ->where('status', 'active');
            },
            'questions.options' => function ($query) {
                $query->select(['question_options.id', 'question_id', 'option_text', 'sort_order', 'is_correct'])
                    ->orderBy('sort_order');
            },
        ]);

        $questions = $quiz->questions;
        // School curriculum & topic practice: deliver 10 random questions per try if the question
        // bank has more, taking a shared passage's questions together and in order.
        if ($questions->count() > Quiz::QUESTIONS_PER_ATTEMPT) {
            $questions = AttemptQuestions::pick($questions, Quiz::QUESTIONS_PER_ATTEMPT);
        } else {
            $questions = AttemptQuestions::pick($questions, PHP_INT_MAX, shuffle: false);
        }

        $user = $request->user() ?? auth()->user() ?? request()->user();
        $isStaff = $user && method_exists($user, 'isAnyAdmin') ? ($user->isAnyAdmin() || $user->isTeacher()) : false;

        return response()->json([
            'quiz' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'description' => $quiz->description,
                'time_limit_minutes' => $quiz->time_limit_minutes,
                // Shared passages, once each; questions point to them with context_id.
                'contexts' => QuestionContext::learnerArrays($questions->pluck('context_id')),
                'questions' => $questions->map(function ($q) use ($isStaff, $user) {
                    $correctOption = $q->options->firstWhere('is_correct', true);

                    return [
                        'id' => $q->id,
                        'topic_id' => $q->topic_id,
                        'context_id' => $q->context_id,
                        'context_order' => $q->context_order,
                        'question_text' => $q->question_text,
                        'image_url' => $q->image_url,
                        'type' => $q->type,
                        'difficulty' => $q->difficulty,
                        // Learners get the explanation sealed (see OfflineAnswerKey): readable on the
                        // device only after grading reveals the correct option, never in storage.
                        'explanation' => $isStaff ? $q->explanation : null,
                        'marks' => (int) ($q->pivot->marks ?? 1),
                        ...OfflineAnswerKey::forQuestion(OfflineAnswerKey::QUIZ, $q->id, $correctOption?->id, $q->explanation),
                        'options' => OptionOrder::forLearner($q->options, $user?->id, $q->id)->map(function ($o) use ($isStaff) {
                            $optionData = [
                                'id' => $o->id,
                                'option_text' => $o->option_text,
                            ];
                            // Only staff (teachers/admins) get plaintext is_correct; learners grade via answer_hash to prevent DevTools peeking
                            if ($isStaff) {
                                $optionData['is_correct'] = (bool) $o->is_correct;
                            }

                            return $optionData;
                        })->values()->all(),
                    ];
                })->values()->all(),
            ],
        ]);
    }

    /**
     * Submit and grade a standard or practice quiz attempt.
     */
    public function submitQuizAttempt(SubmitQuizAttemptRequest $request, Quiz $quiz): JsonResponse|RedirectResponse
    {
        Gate::authorize('attempt', $quiz);
        $user = auth()->user();
        $rawAnswers = $request->validated('answers');

        // Normalize answers whether sent as an associative map {qId: optId} or array of [{question_id, selected_option_id}]
        $submittedAnswers = [];
        if (is_array($rawAnswers)) {
            foreach ($rawAnswers as $key => $val) {
                if (is_array($val) && isset($val['question_id'])) {
                    $submittedAnswers[$val['question_id']] = $val['selected_option_id'] ?? null;
                } else {
                    $submittedAnswers[$key] = $val;
                }
            }
        }

        // Load quiz questions and options with correctness criteria authoritatively on the server
        $quiz->load([
            'questions' => function ($q) {
                $q->where('status', 'active');
            },
            'questions.options',
        ]);

        $questionsToGrade = $quiz->questionsForAttempt(array_keys($submittedAnswers));
        $attemptId = (string) Str::uuid();
        $graded = $this->grader->handle($questionsToGrade, $submittedAnswers, $attemptId, now());
        ['score' => $score, 'total_marks' => $totalMarks, 'answers' => $answersToInsert, 'topic_tallies' => $topicTallies] = $graded;

        DB::beginTransaction();

        try {
            // Create the attempt
            QuizAttempt::create([
                'id' => $attemptId,
                'user_id' => $user->id,
                'quiz_id' => $quiz->id,
                'status' => 'completed',
                'score' => $score,
                'total_marks' => $totalMarks,
                'started_at' => now()->subSeconds($request->input('duration_seconds', 300)),
                'completed_at' => now(),
            ]);

            // Save all quiz answers
            QuizAnswer::insert($answersToInsert);

            // Add this attempt's results to topic progress (atomic, independent of history size).
            LearnerProgress::recordResults($user->id, $topicTallies, now());

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            if ($request->wantsJson()) {
                report($e); // details go to the log, never to the client (they can include SQL)

                return response()->json(['success' => false, 'message' => 'The attempt could not be saved. Please try again.'], 500);
            }
            throw $e;
        }

        // Process gamification rewards (XP, streaks, achievements)
        $attempt = QuizAttempt::find($attemptId)->setRelation('user', $user)->setRelation('quiz', $quiz);
        $newAchievements = $this->gamification->awardQuizCompletionOnce($attempt);

        // Auto-record questions into Spaced Repetition memory engine
        try {
            foreach ($answersToInsert as $ans) {
                $this->spacedRepetition->recordAttempt($user, [
                    'question_id' => $ans['question_id'],
                    'is_correct' => $ans['is_correct'],
                    'selected_option_id' => $ans['selected_option_id'],
                ]);
            }
        } catch (\Throwable $t) {
            Log::warning('SRS quiz attempt record failed: '.$t->getMessage());
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'attempt_id' => $attemptId,
                'score' => $score,
                'total_marks' => $totalMarks,
                'percentage' => $totalMarks > 0 ? (int) round(($score / $totalMarks) * 100) : 0,
                'achievements' => $newAchievements,
            ]);
        }

        return redirect("/quizzes/attempts/{$attemptId}");
    }

    /**
     * Render the student quiz attempt result view.
     */
    public function showQuizResult(QuizAttempt $attempt): Response
    {
        // Authorize access
        if ($attempt->user_id !== auth()->id()) {
            abort(403);
        }

        return Inertia::render('quizzes/Result', [
            'attemptId' => $attempt->id,
        ]);
    }

    /**
     * Sync an offline quiz attempt that was completed without internet.
     * Called by SyncService.ts when the user comes back online.
     */
    public function syncQuizAttempt(SyncQuizAttemptRequest $request, string $attemptId): JsonResponse
    {
        $request->validated();
        $user = auth()->user();

        if (! Str::isUuid($attemptId)) {
            return response()->json(['success' => false, 'code' => 'invalid_attempt_id', 'message' => 'Attempt id must be a UUID.'], 422);
        }

        // Idempotency: the attempt id is generated on the device, so a retry finds the row it already created.
        $existing = QuizAttempt::find($attemptId);
        if ($existing) {
            if ($existing->user_id !== $user->id) {
                return response()->json(['success' => false, 'code' => 'attempt_owner_mismatch', 'message' => 'This attempt belongs to a different account.'], 409);
            }

            return response()->json([
                'success' => true,
                'attempt_id' => $existing->id,
                'score' => $existing->score,
                'total_marks' => $existing->total_marks,
                'already_synced' => true,
            ]);
        }

        $quiz = Quiz::with([
            'questions' => fn ($q) => $q->where('status', 'active'),
            'questions.options',
        ])->findOrFail($request->quiz_id);
        Gate::authorize('recordOfflineAttempt', $quiz);

        $submittedAnswers = collect($request->answers)
            ->filter(fn ($a) => is_array($a) && isset($a['question_id']))
            ->keyBy(fn ($a) => (int) $a['question_id']);

        // If none of the questions the learner saw still exist (the quiz was rebuilt
        // while the device was offline) report it instead of recording a score of zero.
        if ($quiz->questions->whereIn('id', $submittedAnswers->keys()->all())->isEmpty()) {
            return response()->json([
                'success' => false,
                'code' => 'quiz_content_changed',
                'message' => 'The questions in this attempt are no longer part of the quiz.',
            ], 409);
        }

        $questionsToGrade = $quiz->questionsForAttempt($submittedAnswers->keys()->all());

        // Keep the time the learner actually finished, so streaks and history reflect offline
        // days; activityTime clamps a wrong device clock (no future, at most 30 days back).
        $completedAt = GamificationService::activityTime($request->input('completed_at'));
        $durationSeconds = (int) $request->input('duration_seconds', 300);
        $startedAt = $completedAt->copy()->subSeconds($durationSeconds);

        $selected = $submittedAnswers->map(fn ($a) => $a['selected_option_id'] ?? null)->all();
        $graded = $this->grader->handle($questionsToGrade, $selected, $attemptId, $completedAt);
        ['score' => $score, 'total_marks' => $totalMarks, 'answers' => $answersToInsert, 'topic_tallies' => $topicTallies] = $graded;

        try {
            DB::transaction(function () use ($user, $quiz, $attemptId, $score, $totalMarks, $startedAt, $completedAt, $answersToInsert, $topicTallies) {
                $attempt = QuizAttempt::create([
                    'id' => $attemptId,
                    'user_id' => $user->id,
                    'quiz_id' => $quiz->id,
                    'status' => 'completed',
                    'score' => $score,
                    'total_marks' => $totalMarks,
                    'started_at' => $startedAt,
                    'completed_at' => $completedAt,
                ]);

                QuizAnswer::insert($answersToInsert);

                // Add this attempt's results to topic progress (atomic, independent of history size).
                LearnerProgress::recordResults($user->id, $topicTallies, $completedAt);

                // XP, streak and achievements are queued (dispatched once this commits), so a
                // classroom syncing at once isn't slowed down by them. The job is idempotent
                // through quiz_attempts.xp_awarded_at, so retries never award twice.
                AwardQuizCompletionXp::dispatch($attemptId, $completedAt->toIso8601String());
            });
        } catch (UniqueConstraintViolationException $e) {
            // Another request (second tab, or the page's own submit) synced this attempt first.
            $existing = QuizAttempt::find($attemptId);
            if ($existing && $existing->user_id === $user->id) {
                return response()->json(['success' => true, 'attempt_id' => $attemptId, 'already_synced' => true]);
            }
            report($e);

            return response()->json(['success' => false, 'code' => 'sync_conflict', 'message' => 'Could not save this attempt.'], 409);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['success' => false, 'code' => 'sync_failed', 'message' => 'Could not save this attempt. It will be retried.'], 500);
        }

        return response()->json([
            'success' => true,
            'attempt_id' => $attemptId,
            'score' => $score,
            'total_marks' => $totalMarks,
        ]);
    }

    /**
     * Get details and answered breakdown for a completed quiz attempt.
     */
    public function getQuizAttemptData(QuizAttempt $attempt): JsonResponse
    {
        // Authorize access
        if ($attempt->user_id !== auth()->id()) {
            abort(403, 'Forbidden');
        }

        // Load the quiz details, answers, questions, options, and correctness
        $attempt->load([
            'quiz',
            'answers.question.options',
            'answers.question.context',
        ]);

        // Review in the quiz's order (answers come back from the database in no set order: MySQL
        // returns them by id), with a passage's questions together in context_order.
        $position = $attempt->quiz?->questions()->pluck('questions.id')->flip() ?? collect();
        $answers = $attempt->answers->sortBy(fn ($ans) => $position[$ans->question_id] ?? PHP_INT_MAX)->values();
        $orderedAnswers = AttemptQuestions::units($answers->map(fn ($ans) => (object) [
            'id' => $ans->question_id,
            'context_id' => $ans->question?->context_id,
            'context_order' => $ans->question?->context_order,
            'answer' => $ans,
        ]))->flatten(1)->pluck('answer');

        $answersMapped = $orderedAnswers->map(function ($ans) {
            $question = $ans->question;

            return [
                'id' => $ans->id,
                'question_id' => $ans->question_id,
                'question_text' => $question?->question_text ?? ('Question #'.$ans->question_id),
                'context' => $question?->context?->toLearnerArray(),
                'explanation' => $question?->explanation ?? '',
                'selected_option_id' => $ans->selected_option_id,
                'is_correct' => (bool) $ans->is_correct,
                'marks_awarded' => $ans->marks_awarded,
                'options' => $question ? $question->options->map(function ($o) {
                    return [
                        'id' => $o->id,
                        'option_text' => $o->option_text,
                        'is_correct' => (bool) $o->is_correct,
                    ];
                }) : [],
            ];
        });

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'quiz_title' => $attempt->quiz?->title ?? ('Quiz #'.$attempt->quiz_id),
                'score' => $attempt->score,
                'total_marks' => $attempt->total_marks,
                'completed_at' => $attempt->completed_at ? $attempt->completed_at->toIso8601String() : null,
                'answers' => $answersMapped,
            ],
        ]);
    }
}
