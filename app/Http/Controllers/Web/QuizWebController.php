<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
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
use App\Services\Gamification\GamificationService;

class QuizWebController extends Controller
{
    public function getQuiz(Quiz $quiz): JsonResponse
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

        return response()->json([
            'quiz' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'description' => $quiz->description,
                'time_limit_minutes' => $quiz->time_limit_minutes,
                'total_marks' => $quiz->questions->sum(fn ($q) => $q->pivot->marks ?? 1),
                'questions' => $quiz->questions->map(function ($q) {
                    return [
                        'id' => $q->id,
                        'topic_id' => $q->topic_id,
                        'question_text' => $q->question_text,
                        'type' => $q->type,
                        'difficulty' => $q->difficulty,
                        'explanation' => $q->explanation,
                        'marks' => $q->pivot->marks ?? 1,
                        'options' => $q->options->map(function ($o) {
                            return [
                                'id' => $o->id,
                                'option_text' => $o->option_text,
                                'is_correct' => (bool) $o->is_correct,
                            ];
                        })
                    ];
                })
            ]
        ]);
    }

    /**
     * Submit a quiz attempt directly via the API.
     */
    public function submitQuiz(Request $request, Quiz $quiz): JsonResponse
    {
        $request->validate([
            'answers'          => ['required', 'array'],
            'duration_seconds' => ['nullable', 'integer'],
            'attempt_id'       => ['nullable', 'string'],
        ]);

        $user = auth()->user();
        $attemptId = $request->input('attempt_id') ?: (string) Str::uuid();

        // Idempotency: If attempt already exists, return it
        $existing = QuizAttempt::where('id', $attemptId)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => true,
                'attempt_id' => $existing->id,
                'score' => $existing->score,
                'total_marks' => $existing->total_marks,
                'already_submitted' => true,
            ]);
        }

        $quiz->load([
            'questions' => fn ($q) => $q->where('status', 'active'),
            'questions.options',
        ]);

        $score = 0;
        $totalMarks = 0;
        $answersToInsert = [];
        $topicIdsEvaluated = [];

        DB::beginTransaction();

        try {
            foreach ($quiz->questions as $question) {
                $pivotMarks = $question->pivot->marks ?? 1;
                $totalMarks += $pivotMarks;

                // Support both key-value map and array of answer objects
                $selectedOptionId = null;
                if (isset($request->answers[$question->id])) {
                    $selectedOptionId = is_array($request->answers[$question->id])
                        ? ($request->answers[$question->id]['selected_option_id'] ?? null)
                        : $request->answers[$question->id];
                } else {
                    $submittedAnswer = collect($request->answers)->firstWhere('question_id', $question->id);
                    $selectedOptionId = $submittedAnswer['selected_option_id'] ?? null;
                }

                $isCorrect = false;
                $marksAwarded = 0;

                if ($selectedOptionId) {
                    $option = $question->options->firstWhere('id', $selectedOptionId);
                    if ($option && $option->is_correct) {
                        $isCorrect = true;
                        $marksAwarded = $pivotMarks;
                        $score += $pivotMarks;
                    }
                }

                $answersToInsert[] = [
                    'id' => (string) Str::uuid(),
                    'quiz_attempt_id' => $attemptId,
                    'question_id' => $question->id,
                    'selected_option_id' => $selectedOptionId,
                    'is_correct' => $isCorrect,
                    'marks_awarded' => $marksAwarded,
                    'answered_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $topicIdsEvaluated[$question->topic_id] = true;
            }

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

            QuizAnswer::insert($answersToInsert);

            // Batch compute all evaluated topic stats in ONE query instead of 2N correlated whereHas subqueries
            $topicStats = DB::table('quiz_answers as qa')
                ->join('quiz_attempts as qat', 'qa.quiz_attempt_id', '=', 'qat.id')
                ->join('questions as q', 'qa.question_id', '=', 'q.id')
                ->where('qat.user_id', $user->id)
                ->whereIn('q.topic_id', array_keys($topicIdsEvaluated))
                ->groupBy('q.topic_id')
                ->selectRaw('
                    q.topic_id,
                    COUNT(*) as questions_attempted,
                    SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as questions_correct
                ')
                ->get()
                ->keyBy('topic_id');

            $now = now();
            foreach (array_keys($topicIdsEvaluated) as $topicId) {
                $stat = $topicStats->get($topicId);
                $attempted = (int) ($stat?->questions_attempted ?? 0);
                $correct   = (int) ($stat?->questions_correct ?? 0);
                $masteryScore = $attempted > 0 ? (int) round(($correct / $attempted) * 100) : 0;

                LearnerProgress::updateOrCreate(
                    ['user_id' => $user->id, 'topic_id' => $topicId],
                    [
                        'questions_attempted' => $attempted,
                        'questions_correct'   => $correct,
                        'mastery_score'       => $masteryScore,
                        'last_attempted_at'   => $now,
                    ]
                );
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }

        $attempt = QuizAttempt::find($attemptId);
        $gamificationService = app(GamificationService::class);
        $newAchievements = $gamificationService->processQuizCompletion($user, $attempt, $quiz);

        return response()->json([
            'success' => true,
            'attempt_id' => $attemptId,
            'score' => $score,
            'total_marks' => $totalMarks,
            'percentage' => $totalMarks > 0 ? (int) round(($score / $totalMarks) * 100) : 0,
            'achievements' => $newAchievements,
        ]);
    }

    /**
     * Sync an offline quiz attempt that was completed without internet.
     * Called by SyncService.ts when the user comes back online.
     */
    public function syncAttempt(Request $request, string $attemptId): JsonResponse
    {
        $request->validate([
            'quiz_id'          => ['required', 'integer', 'exists:quizzes,id'],
            'answers'          => ['required', 'array'],
            'duration_seconds' => ['nullable', 'integer'],
        ]);

        $user = auth()->user();

        // Idempotency: if already synced, return the existing attempt
        $existing = QuizAttempt::where('id', $attemptId)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            return response()->json(['success' => true, 'attempt_id' => $existing->id, 'already_synced' => true]);
        }

        $quiz = Quiz::with([
            'questions' => fn ($q) => $q->where('status', 'active'),
            'questions.options',
        ])->findOrFail($request->quiz_id);

        $score      = 0;
        $totalMarks = 0;
        $answersToInsert    = [];
        $topicIdsEvaluated  = [];

        DB::beginTransaction();

        try {
            foreach ($quiz->questions as $question) {
                $pivotMarks = $question->pivot->marks ?? 1;
                $totalMarks += $pivotMarks;

                // SyncService sends answers keyed by question_id
                $submittedAnswer = collect($request->answers)
                    ->firstWhere('question_id', $question->id);

                $selectedOptionId = $submittedAnswer['selected_option_id'] ?? null;
                $isCorrect        = false;
                $marksAwarded     = 0;

                if ($selectedOptionId) {
                    $option = $question->options->firstWhere('id', $selectedOptionId);
                    if ($option && $option->is_correct) {
                        $isCorrect    = true;
                        $marksAwarded = $pivotMarks;
                        $score       += $pivotMarks;
                    }
                }

                $answersToInsert[] = [
                    'id'              => (string) Str::uuid(),
                    'quiz_attempt_id' => $attemptId,
                    'question_id'     => $question->id,
                    'selected_option_id' => $selectedOptionId,
                    'is_correct'      => $isCorrect,
                    'marks_awarded'   => $marksAwarded,
                    'answered_at'     => now(),
                    'created_at'      => now(),
                    'updated_at'      => now(),
                ];

                $topicIdsEvaluated[$question->topic_id] = true;
            }

            QuizAttempt::create([
                'id'           => $attemptId,
                'user_id'      => $user->id,
                'quiz_id'      => $quiz->id,
                'status'       => 'completed',
                'score'        => $score,
                'total_marks'  => $totalMarks,
                'started_at'   => now()->subSeconds($request->input('duration_seconds', 300)),
                'completed_at' => now(),
            ]);

            QuizAnswer::insert($answersToInsert);

            // Batch compute all evaluated topic stats in ONE query instead of 2N correlated whereHas subqueries
            $topicStats = DB::table('quiz_answers as qa')
                ->join('quiz_attempts as qat', 'qa.quiz_attempt_id', '=', 'qat.id')
                ->join('questions as q', 'qa.question_id', '=', 'q.id')
                ->where('qat.user_id', $user->id)
                ->whereIn('q.topic_id', array_keys($topicIdsEvaluated))
                ->groupBy('q.topic_id')
                ->selectRaw('
                    q.topic_id,
                    COUNT(*) as questions_attempted,
                    SUM(CASE WHEN qa.is_correct = 1 THEN 1 ELSE 0 END) as questions_correct
                ')
                ->get()
                ->keyBy('topic_id');

            $now = now();
            foreach (array_keys($topicIdsEvaluated) as $topicId) {
                $stat = $topicStats->get($topicId);
                $attempted = (int) ($stat?->questions_attempted ?? 0);
                $correct   = (int) ($stat?->questions_correct ?? 0);
                $masteryScore = $attempted > 0 ? (int) round(($correct / $attempted) * 100) : 0;

                LearnerProgress::updateOrCreate(
                    ['user_id' => $user->id, 'topic_id' => $topicId],
                    [
                        'questions_attempted' => $attempted,
                        'questions_correct'   => $correct,
                        'mastery_score'       => $masteryScore,
                        'last_attempted_at'   => $now,
                    ]
                );
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'error' => $e->getMessage()], 422);
        }

        $attempt = QuizAttempt::find($attemptId);
        $gamificationService = app(GamificationService::class);
        $gamificationService->processQuizCompletion($user, $attempt, $quiz);

        return response()->json(['success' => true, 'attempt_id' => $attemptId]);
    }

    public function getAttempt(QuizAttempt $attempt): JsonResponse
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
                'quiz_title' => $attempt->quiz?->title ?? 'Quiz Assessment',
                'score' => $attempt->score,
                'total_marks' => $attempt->total_marks,
                'completed_at' => $attempt->completed_at ? $attempt->completed_at->toIso8601String() : null,
                'answers' => $answersMapped,
            ]
        ]);
    }
}
