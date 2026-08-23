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
use Inertia\Inertia;
use Inertia\Response;
use App\Services\Gamification\GamificationService;

class QuizWebController extends Controller
{
    public function show(Quiz $quiz): Response
    {
        return Inertia::render('quizzes/Show', [
            'quizId' => $quiz->id,
        ]);
    }

    public function getQuizData(Quiz $quiz): JsonResponse
    {
        // Eager load questions and options
        $quiz->load([
            'questions' => function ($query) {
                $query->select(['questions.id', 'topic_id', 'question_text', 'type', 'difficulty'])
                      ->where('status', 'active');
            },
            'questions.options' => function ($query) {
                $query->select(['question_options.id', 'question_id', 'option_text', 'sort_order'])
                      ->orderBy('sort_order');
            }
        ]);

        return response()->json([
            'quiz' => [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'description' => $quiz->description,
                'time_limit_minutes' => $quiz->time_limit_minutes,
                'questions' => $quiz->questions->map(function ($q) {
                    return [
                        'id' => $q->id,
                        'topic_id' => $q->topic_id,
                        'question_text' => $q->question_text,
                        'type' => $q->type,
                        'options' => $q->options->map(function ($o) {
                            return [
                                'id' => $o->id,
                                'option_text' => $o->option_text,
                            ];
                        })
                    ];
                })
            ]
        ]);
    }

    public function submit(Request $request, Quiz $quiz): RedirectResponse
    {
        $request->validate([
            'answers' => ['required', 'array'],
        ]);

        $user = auth()->user();
        $submittedAnswers = $request->input('answers'); // array mapping question_id -> selected_option_id

        // Load quiz questions and options with correctness criteria authoritatively on the server
        $quiz->load([
            'questions' => function ($q) {
                $q->where('status', 'active');
            },
            'questions.options'
        ]);

        $score = 0;
        $totalMarks = 0;
        $attemptId = (string) Str::uuid();

        DB::beginTransaction();

        try {
            $answersToInsert = [];
            $topicIdsEvaluated = [];

            foreach ($quiz->questions as $question) {
                $questionId = $question->id;
                $pivotMarks = $question->pivot->marks ?? 1;
                $totalMarks += $pivotMarks;

                $selectedOptionId = $submittedAnswers[$questionId] ?? null;
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
                    'question_id' => $questionId,
                    'selected_option_id' => $selectedOptionId,
                    'is_correct' => $isCorrect,
                    'marks_awarded' => $marksAwarded,
                    'answered_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                $topicIdsEvaluated[$question->topic_id] = true;
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

            // Update topic progress mastery calculations for topics covered in this quiz
            foreach (array_keys($topicIdsEvaluated) as $topicId) {
                $topicQuestionsCount = QuizAnswer::whereHas('question', function ($q) use ($topicId) {
                    $q->where('topic_id', $topicId);
                })->whereHas('attempt', function ($q) use ($user) {
                    $q->where('user_id', $user->id);
                })->count();

                $topicCorrectQuestionsCount = QuizAnswer::whereHas('question', function ($q) use ($topicId) {
                    $q->where('topic_id', $topicId);
                })->whereHas('attempt', function ($q) use ($user) {
                    $q->where('user_id', $user->id);
                })->where('is_correct', true)->count();

                $masteryScore = $topicQuestionsCount > 0 ? (int) round(($topicCorrectQuestionsCount / $topicQuestionsCount) * 100) : 0;

                LearnerProgress::updateOrCreate(
                    ['user_id' => $user->id, 'topic_id' => $topicId],
                    [
                        'questions_attempted' => $topicQuestionsCount,
                        'questions_correct' => $topicCorrectQuestionsCount,
                        'mastery_score' => $masteryScore,
                        'last_attempted_at' => now(),
                    ]
                );
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }

        // Process gamification rewards (XP, streaks, achievements)
        $attempt = QuizAttempt::find($attemptId);
        $gamificationService = app(GamificationService::class);
        $newAchievements = $gamificationService->processQuizCompletion($user, $attempt, $quiz);

        return redirect("/quizzes/attempts/{$attemptId}");
    }

    public function result(QuizAttempt $attempt): Response
    {
        // Authorize access
        if ($attempt->user_id !== auth()->id()) {
            abort(403);
        }

        return Inertia::render('quizzes/Result', [
            'attemptId' => $attempt->id,
        ]);
    }

    public function getAttemptData(QuizAttempt $attempt): JsonResponse
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
            return [
                'id' => $ans->id,
                'question_id' => $ans->question_id,
                'question_text' => $ans->question->question_text,
                'explanation' => $ans->question->explanation,
                'selected_option_id' => $ans->selected_option_id,
                'is_correct' => (bool)$ans->is_correct,
                'marks_awarded' => $ans->marks_awarded,
                'options' => $ans->question->options->map(function ($o) {
                    return [
                        'id' => $o->id,
                        'option_text' => $o->option_text,
                        'is_correct' => (bool)$o->is_correct,
                    ];
                })
            ];
        });

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'quiz_title' => $attempt->quiz->title,
                'score' => $attempt->score,
                'total_marks' => $attempt->total_marks,
                'completed_at' => $attempt->completed_at ? $attempt->completed_at->toIso8601String() : null,
                'answers' => $answersMapped,
            ]
        ]);
    }
}
