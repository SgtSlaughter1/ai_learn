<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\Quiz\SubmitQuizAttemptRequest;
use App\Http\Requests\Quiz\SyncQuizAttemptRequest;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\QuizAnswer;
use App\Models\Question;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use App\Jobs\AwardQuizCompletionXp;
use App\Services\Gamification\GamificationService;

class QuizWebController extends Controller
{
    /**
     * Render the student quiz taking interface.
     */
    public function showQuiz(Request $request, Quiz $quiz): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user?->isAnyAdmin()) {
            return redirect('/admin/dashboard');
        }
        return Inertia::render('quizzes/Show', [
            'quizId' => $quiz->id,
        ]);
    }

    /**
     * Backward-compatible alias for showQuiz.
     */
    public function show(Request $request, Quiz $quiz): Response|RedirectResponse
    {
        return $this->showQuiz($request, $quiz);
    }

    public function getQuizData(Request $request, Quiz $quiz): JsonResponse
    {
        // Eager load questions and options (including explanation and is_correct for offline caching)
        $quiz->load([
            'questions' => function ($query) {
                $query->select(['questions.id', 'topic_id', 'question_text', 'type', 'difficulty', 'explanation'])
                      ->where('status', 'active');
            },
            'questions.options' => function ($query) {
                $query->select(['question_options.id', 'question_id', 'option_text', 'sort_order', 'is_correct'])
                      ->orderBy('sort_order');
            }
        ]);

        $questions = $quiz->questions;
        // School curriculum & topic practice: deliver 10 random questions per try if the question bank has more
        if ($questions->count() > 10) {
            $questions = $questions->shuffle()->take(10)->values();
        }

        $user = $request->user() ?? auth()->user() ?? request()->user();
        $isStaff = $user && method_exists($user, 'isAnyAdmin') ? ($user->isAnyAdmin() || $user->isTeacher()) : false;

        return response()->json([
            'quiz' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'description' => $quiz->description,
                'time_limit_minutes' => $quiz->time_limit_minutes,
                'questions' => $questions->map(function ($q) use ($isStaff) {
                    $correctOption = $q->options->firstWhere('is_correct', true);
                    $answerHash = $correctOption ? hash('sha256', "acedrill_salt_q_{$q->id}_opt_{$correctOption->id}") : null;

                    return [
                        'id' => $q->id,
                        'topic_id' => $q->topic_id,
                        'question_text' => $q->question_text,
                        'type' => $q->type,
                        'difficulty' => $q->difficulty,
                        'explanation' => $q->explanation,
                        'marks' => (int) ($q->pivot->marks ?? 1),
                        'answer_hash' => $answerHash,
                        'options' => $q->options->map(function ($o) use ($isStaff) {
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
            ]
        ]);
    }

    /**
     * Submit and grade a standard or practice quiz attempt.
     */
    public function submitQuizAttempt(SubmitQuizAttemptRequest $request, Quiz $quiz): JsonResponse|RedirectResponse
    {
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
            'questions.options'
        ]);

        $submittedQuestionIds = array_keys($submittedAnswers);
        $questionsToGrade = !empty($submittedQuestionIds)
            ? $quiz->questions->whereIn('id', $submittedQuestionIds)
            : $quiz->questions;

        if ($questionsToGrade->isEmpty()) {
            $questionsToGrade = $quiz->questions->take(10);
        }

        $score = 0;
        $totalMarks = 0;
        $attemptId = (string) Str::uuid();

        DB::beginTransaction();

        try {
            $answersToInsert = [];
            $topicTallies = [];

            foreach ($questionsToGrade as $question) {
                $questionId = $question->id;
                $pivotMarks = $question->pivot->marks ?? 1;
                $totalMarks += $pivotMarks;

                $selectedOptionId = $submittedAnswers[$questionId] ?? null;
                $isCorrect = false;
                $marksAwarded = 0;

                if (is_array($selectedOptionId)) {
                    $correctOptionIds = $question->options->where('is_correct', true)->pluck('id')->map(fn($id) => (int) $id)->sort()->values()->all();
                    $studentOptionIds = collect($selectedOptionId)->map(fn($id) => (int) $id)->sort()->values()->all();
                    if (!empty($correctOptionIds) && $correctOptionIds === $studentOptionIds) {
                        $isCorrect = true;
                        $marksAwarded = $pivotMarks;
                        $score += $pivotMarks;
                    }
                    $recordedOptionId = !empty($studentOptionIds) ? $studentOptionIds[0] : null;
                } elseif ($selectedOptionId) {
                    $option = $question->options->firstWhere('id', $selectedOptionId);
                    if ($option && $option->is_correct) {
                        $isCorrect = true;
                        $marksAwarded = $pivotMarks;
                        $score += $pivotMarks;
                    }
                    $recordedOptionId = $selectedOptionId;
                } else {
                    $recordedOptionId = null;
                }

                $answersToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'quiz_attempt_id' => $attemptId,
                    'question_id' => $questionId,
                    'selected_option_id' => $recordedOptionId,
                    'is_correct' => $isCorrect,
                    'marks_awarded' => $marksAwarded,
                    'answered_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $topicTallies[$question->topic_id] ??= ['attempted' => 0, 'correct' => 0];
                $topicTallies[$question->topic_id]['attempted']++;
                $topicTallies[$question->topic_id]['correct'] += $isCorrect ? 1 : 0;
            }

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
                return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
            }
            throw $e;
        }

        // Process gamification rewards (XP, streaks, achievements)
        $attempt = QuizAttempt::find($attemptId)->setRelation('user', $user)->setRelation('quiz', $quiz);
        $gamificationService = app(GamificationService::class);
        $newAchievements = $gamificationService->awardQuizCompletionOnce($attempt);

        // Auto-record questions into Spaced Repetition memory engine
        try {
            $srsService = app(\App\Services\SpacedRepetition\SpacedRepetitionService::class);
            foreach ($answersToInsert as $ans) {
                $srsService->recordAttempt($user, [
                    'question_id' => $ans['question_id'],
                    'is_correct' => $ans['is_correct'],
                    'selected_option_id' => $ans['selected_option_id'],
                ]);
            }
        } catch (\Throwable $t) {
            \Illuminate\Support\Facades\Log::warning('SRS quiz attempt record failed: ' . $t->getMessage());
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
     * Backward-compatible alias for submitQuizAttempt.
     */
    public function submit(SubmitQuizAttemptRequest $request, Quiz $quiz): JsonResponse|RedirectResponse
    {
        return $this->submitQuizAttempt($request, $quiz);
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
     * Backward-compatible alias for showQuizResult.
     */
    public function result(QuizAttempt $attempt): Response
    {
        return $this->showQuizResult($attempt);
    }

    /**
     * Sync an offline quiz attempt that was completed without internet.
     * Called by SyncService.ts when the user comes back online.
     */
    public function syncQuizAttempt(SyncQuizAttemptRequest $request, string $attemptId): JsonResponse
    {
        $request->validated();
        $user = auth()->user();

        if (!Str::isUuid($attemptId)) {
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

        $submittedAnswers = collect($request->answers)
            ->filter(fn ($a) => is_array($a) && isset($a['question_id']))
            ->keyBy(fn ($a) => (int) $a['question_id']);

        // Grade only questions the learner actually saw. If none of them still exist
        // (the quiz was rebuilt while the device was offline) report it instead of
        // recording a score of zero.
        $questionsToGrade = $quiz->questions->whereIn('id', $submittedAnswers->keys()->all());
        if ($questionsToGrade->isEmpty()) {
            return response()->json([
                'success' => false,
                'code' => 'quiz_content_changed',
                'message' => 'The questions in this attempt are no longer part of the quiz.',
            ], 409);
        }

        // Keep the time the learner actually finished, so streaks and history reflect
        // offline days. Clamp it so a wrong device clock cannot push it into the future
        // or far into the past.
        $completedAt = $request->filled('completed_at')
            ? \Illuminate\Support\Carbon::parse($request->completed_at)
            : now();
        if ($completedAt->isFuture()) {
            $completedAt = now();
        }
        if ($completedAt->lt(now()->subDays(30))) {
            $completedAt = now()->subDays(30);
        }
        $durationSeconds = (int) $request->input('duration_seconds', 300);
        $startedAt = $completedAt->copy()->subSeconds($durationSeconds);

        $score      = 0;
        $totalMarks = 0;
        $answersToInsert    = [];
        $topicTallies       = [];

        foreach ($questionsToGrade as $question) {
            $pivotMarks = $question->pivot->marks ?? 1;
            $totalMarks += $pivotMarks;

            $selected = $submittedAnswers->get($question->id)['selected_option_id'] ?? null;
            $validOptionIds = $question->options->pluck('id')->map(fn ($id) => (int) $id);
            $isCorrect = false;

            if (is_array($selected)) {
                $studentOptionIds = collect($selected)->map(fn ($id) => (int) $id)
                    ->filter(fn ($id) => $validOptionIds->contains($id))
                    ->sort()->values()->all();
                $correctOptionIds = $question->options->where('is_correct', true)
                    ->pluck('id')->map(fn ($id) => (int) $id)->sort()->values()->all();
                $isCorrect = !empty($correctOptionIds) && $correctOptionIds === $studentOptionIds;
                $recordedOptionId = $studentOptionIds[0] ?? null;
            } else {
                // An option id the question no longer has is stored as "no answer",
                // never as a dangling foreign key.
                $recordedOptionId = $selected !== null && $validOptionIds->contains((int) $selected) ? (int) $selected : null;
                $isCorrect = $recordedOptionId !== null
                    && (bool) $question->options->firstWhere('id', $recordedOptionId)?->is_correct;
            }

            $marksAwarded = $isCorrect ? $pivotMarks : 0;
            $score += $marksAwarded;

            $answersToInsert[] = [
                'id'              => (string) Str::uuid(),
                'quiz_attempt_id' => $attemptId,
                'question_id'     => $question->id,
                'selected_option_id' => $recordedOptionId,
                'is_correct'      => $isCorrect,
                'marks_awarded'   => $marksAwarded,
                'answered_at'     => $completedAt,
                'created_at'      => now(),
                'updated_at'      => now(),
            ];

            $topicTallies[$question->topic_id] ??= ['attempted' => 0, 'correct' => 0];
            $topicTallies[$question->topic_id]['attempted']++;
            $topicTallies[$question->topic_id]['correct'] += $isCorrect ? 1 : 0;
        }

        try {
            DB::transaction(function () use ($user, $quiz, $attemptId, $score, $totalMarks, $startedAt, $completedAt, $answersToInsert, $topicTallies) {
                $attempt = QuizAttempt::create([
                    'id'           => $attemptId,
                    'user_id'      => $user->id,
                    'quiz_id'      => $quiz->id,
                    'status'       => 'completed',
                    'score'        => $score,
                    'total_marks'  => $totalMarks,
                    'started_at'   => $startedAt,
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
        } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
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
     * Backward-compatible alias for syncQuizAttempt.
     */
    public function syncAttempt(SyncQuizAttemptRequest $request, string $attemptId): JsonResponse
    {
        return $this->syncQuizAttempt($request, $attemptId);
    }

    /**
     * Get details and answered breakdown for a completed quiz attempt.
     */
    public function getQuizAttemptData(QuizAttempt $attempt): JsonResponse
    {
        // Authorize access
        if ($attempt->user_id !== auth()->id()) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        // Load the quiz details, answers, questions, options, and correctness
        $attempt->load([
            'quiz',
            'answers.question.options'
        ]);

        $answersMapped = $attempt->answers->map(function ($ans) {
            $question = $ans->question;
            return [
                'id' => $ans->id,
                'question_id' => $ans->question_id,
                'question_text' => $question?->question_text ?? ('Question #' . $ans->question_id),
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
                'quiz_title' => $attempt->quiz?->title ?? ('Quiz #' . $attempt->quiz_id),
                'score' => $attempt->score,
                'total_marks' => $attempt->total_marks,
                'completed_at' => $attempt->completed_at ? $attempt->completed_at->toIso8601String() : null,
                'answers' => $answersMapped,
            ]
        ]);
    }

    /**
     * Backward-compatible alias for getQuizAttemptData.
     */
    public function getAttemptData(QuizAttempt $attempt): JsonResponse
    {
        return $this->getQuizAttemptData($attempt);
    }
}
