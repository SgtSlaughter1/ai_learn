<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PastQuestion\ExplainPastQuestionRequest;
use App\Http\Requests\PastQuestion\StartExamSimulationRequest;
use App\Http\Requests\PastQuestion\SubmitExamSimulationRequest;
use App\Http\Requests\PastQuestion\VerifyPastQuestionAnswerRequest;
use App\Models\ExamSimulation;
use App\Models\LearnerProgress;
use App\Models\PastQuestion;
use App\Models\PastQuestionOption;
use App\Models\Subject;
use App\Models\Topic;
use App\Services\AIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class PastQuestionController extends Controller
{
    public function __construct(
        protected AIService $aiService
    ) {}

    /**
     * Get metadata for past questions (available exams, subjects, years, and stats).
     * Cached on backend for 5 minutes.
     */
    public function getMeta(Request $request): JsonResponse
    {
        $schoolId = $request->query('school_id');
        $user = Auth::user() ?? $request->user();
        $isGuest = !$user;

        $cacheKey = 'past_questions:meta:v1' . ($schoolId ? ":{$schoolId}" : '');

        $cachedMeta = Cache::remember($cacheKey, now()->addMinutes(5), function () {
            // Available standard exams
            $examsConfig = [
                [
                    'code' => 'jamb',
                    'name' => 'JAMB (UTME)',
                    'fullName' => 'Joint Admissions and Matriculation Board - Unified Tertiary Matriculation Examination',
                    'description' => 'Computer-Based Test simulation for university, polytechnic, and college admissions across Nigeria.',
                    'badge' => 'Tertiary Entrance',
                    'color' => 'primary',
                    'defaultDurationMinutes' => 40,
                    'defaultQuestionCount' => 40,
                ],
                [
                    'code' => 'waec',
                    'name' => 'WAEC (WASSCE)',
                    'fullName' => 'West African Examinations Council - Senior School Certificate Examination',
                    'description' => 'Comprehensive Senior Secondary Certificate Examination past papers with step-by-step working.',
                    'badge' => 'Senior Secondary',
                    'color' => 'primary-light',
                    'defaultDurationMinutes' => 45,
                    'defaultQuestionCount' => 50,
                ],
                [
                    'code' => 'neco',
                    'name' => 'NECO (SSCE)',
                    'fullName' => 'National Examinations Council - Senior School Certificate Examination',
                    'description' => 'Authentic National Senior School Certificate Examination papers and theoretical reviews.',
                    'badge' => 'Senior Secondary',
                    'color' => 'accent',
                    'defaultDurationMinutes' => 45,
                    'defaultQuestionCount' => 40,
                ],
                [
                    'code' => 'post_utme',
                    'name' => 'Post-UTME',
                    'fullName' => 'Post-UTME University Screening Examinations',
                    'description' => 'University screening CBT questions for Nigerian federal and state universities.',
                    'badge' => 'Screening',
                    'color' => 'warning',
                    'defaultDurationMinutes' => 30,
                    'defaultQuestionCount' => 30,
                ],
                [
                    'code' => 'bece',
                    'name' => 'BECE (Junior WAEC)',
                    'fullName' => 'Basic Education Certificate Examination (JSS3 / Grade 9 Transition)',
                    'description' => 'Junior Secondary transitional exam questions for Junior WAEC and state-level exams.',
                    'badge' => 'Junior Secondary',
                    'color' => 'success',
                    'defaultDurationMinutes' => 30,
                    'defaultQuestionCount' => 30,
                ],
            ];

            // Query counts per exam from dedicated past_questions table
            $examCounts = PastQuestion::select('exam_code', DB::raw('count(*) as count'))
                ->groupBy('exam_code')
                ->pluck('count', 'exam_code')
                ->all();

            // Distinct years grouped by exam_code
            $yearsByExam = PastQuestion::whereNotNull('exam_year')
                ->select('exam_code', 'exam_year')
                ->distinct()
                ->orderBy('exam_year', 'desc')
                ->get()
                ->groupBy('exam_code')
                ->map(fn ($rows) => $rows->pluck('exam_year')->values()->all());

            $exams = array_map(function ($exam) use ($examCounts, $yearsByExam) {
                $code = $exam['code'];
                $exam['questionCount'] = $examCounts[$code] ?? 0;
                $exam['available_years'] = $yearsByExam->get($code, []);
                return $exam;
            }, $examsConfig);

            // Distinct years across all
            $years = PastQuestion::whereNotNull('exam_year')
                ->distinct()
                ->orderBy('exam_year', 'desc')
                ->pluck('exam_year');

            // Available subjects with past questions & per-exam breakdown
            $subjectsWithQuestions = Subject::whereHas('pastQuestions')
                ->withCount('pastQuestions as questions_count')
                ->orderBy('name')
                ->get(['id', 'name', 'slug']);

            // Attach available exam codes and available years map for each subject
            $subjectExamRows = PastQuestion::whereNotNull('exam_year')
                ->select('subject_id', 'exam_code', 'exam_year')
                ->distinct()
                ->orderBy('exam_year', 'desc')
                ->get();

            $subjectExamMap = $subjectExamRows->groupBy('subject_id')
                ->map(fn ($rows) => $rows->pluck('exam_code')->unique()->values()->all());

            $subjectYearsByExamMap = $subjectExamRows->groupBy('subject_id')
                ->map(function ($rows) {
                    return $rows->groupBy('exam_code')
                        ->map(fn ($group) => $group->pluck('exam_year')->unique()->values()->all());
                });

            $subjectExamCounts = PastQuestion::select('subject_id', 'exam_code', DB::raw('count(*) as count'))
                ->groupBy('subject_id', 'exam_code')
                ->get()
                ->groupBy('subject_id')
                ->map(fn ($rows) => $rows->pluck('count', 'exam_code')->all());

            $subjectsData = $subjectsWithQuestions->map(function ($s) use ($subjectExamMap, $subjectYearsByExamMap, $subjectExamCounts) {
                $sArray = $s->toArray();
                $sArray['available_exams'] = $subjectExamMap->get($s->id, []);
                $sArray['available_years_by_exam'] = $subjectYearsByExamMap->get($s->id, []);
                $sArray['counts_by_exam'] = $subjectExamCounts->get($s->id, []);
                return $sArray;
            })->values()->all();

            $totalQuestions = PastQuestion::count();

            return [
                'exams' => $exams,
                'years' => $years,
                'years_by_exam' => $yearsByExam,
                'subjects' => $subjectsData,
                'total_questions' => $totalQuestions,
            ];
        });

        return response()->json([
            'success' => true,
            'is_guest' => $isGuest,
            'guest_question_limit' => 20,
            'data' => array_merge($cachedMeta, [
                'is_guest' => $isGuest,
                'guest_question_limit' => 20,
            ]),
        ]);
    }

    /**
     * Get past questions filtered by exam, subject, year, or topic.
     * Unauthenticated (guest) users are strictly capped to 20 questions max.
     */
    public function getQuestions(Request $request): JsonResponse
    {
        $user = Auth::user() ?? $request->user();
        $isGuest = !$user;

        $examCode = $request->query('exam_code');
        $examYear = $request->query('year');
        $subjectSlug = $request->query('subject');
        $subjectId = $request->query('subject_id');
        $topicId = $request->query('topic_id');

        // Unauthenticated guests are capped to a maximum of 20 questions alone
        $requestedLimit = (int) ($request->query('limit', 40));
        $limit = $isGuest ? min($requestedLimit, 20) : min($requestedLimit, 100);
        $random = $request->boolean('random', true);

        $query = PastQuestion::with([
            'options',
            'topic.subject',
            'subject',
        ]);

        if ($examCode && strtolower($examCode) !== 'all') {
            $query->where('exam_code', strtolower($examCode));
        }

        if ($examYear && (int) $examYear > 0) {
            $query->where('exam_year', (int) $examYear);
        }

        if ($topicId) {
            $query->where('topic_id', $topicId);
        } elseif ($subjectId) {
            $query->where('subject_id', $subjectId);
        } elseif ($subjectSlug && $subjectSlug !== 'all') {
            $query->where(function ($q) use ($subjectSlug) {
                $q->whereHas('subject', function ($sq) use ($subjectSlug) {
                    $sq->where('slug', $subjectSlug)
                       ->orWhere('name', 'LIKE', '%' . str_replace('-', ' ', $subjectSlug) . '%');
                })->orWhereHas('topic.subject', function ($tq) use ($subjectSlug) {
                    $tq->where('slug', $subjectSlug)
                       ->orWhere('name', 'LIKE', '%' . str_replace('-', ' ', $subjectSlug) . '%');
                });
            });
        }

        if ($random) {
            $query->inRandomOrder();
        } else {
            $query->orderBy('question_number', 'asc')->orderBy('id', 'asc');
        }

        $questions = $query->limit($limit)->get();

        $user = Auth::user() ?? $request->user();
        $isGuest = !$user;
        $isAdmin = $user && method_exists($user, 'isAnyAdmin') ? $user->isAnyAdmin() : ($user && method_exists($user, 'isAdmin') && $user->isAdmin());

        // Always hide answers by default so learners cannot inspect client-side state/HTML
        $hideAnswers = !($isAdmin && $request->boolean('include_answers', false));

        // Transform questions for front-end consumption
        $formatted = $questions->map(function (PastQuestion $q) use ($hideAnswers) {
            $subject = $q->subject ?? $q->topic?->subject;
            return [
                'id' => $q->id,
                'exam_code' => $q->exam_code,
                'exam_display_name' => $q->exam_display_name,
                'exam_year' => $q->exam_year,
                'paper_type' => $q->paper_type,
                'question_number' => $q->question_number,
                'question_text' => $q->question_text,
                'passage_text' => $q->passage_text,
                'image_url' => $q->image_url,
                'difficulty' => $q->difficulty,
                'explanation' => $hideAnswers ? null : $q->explanation,
                'topic' => [
                    'id' => $q->topic?->id,
                    'name' => $q->topic?->name,
                    'level' => $q->topic?->level,
                ],
                'subject' => [
                    'id' => $subject?->id,
                    'name' => $subject?->name,
                    'slug' => $subject?->slug,
                ],
                'options' => $q->options->map(function (PastQuestionOption $opt, $index) use ($hideAnswers) {
                    $letter = $opt->option_key ?: chr(65 + $index); // A, B, C, D...
                    $optData = [
                        'id' => $opt->id,
                        'key' => strtolower($letter),
                        'label' => $letter,
                        'option_text' => $opt->option_text,
                    ];
                    if (!$hideAnswers) {
                        $optData['is_correct'] = (bool) $opt->is_correct;
                    }
                    return $optData;
                })->values()->all(),
            ];
        })->values()->all();

        return response()->json([
            'success' => true,
            'count' => count($formatted),
            'is_guest' => $isGuest,
            'guest_limit' => 20,
            'data' => $formatted,
        ]);
    }

    /**
     * Verify a learner's answer for a single past question during interactive practice.
     * Evaluates securely server-side so answers are never sent with the question.
     */
    public function verifyAnswer(VerifyPastQuestionAnswerRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $question = PastQuestion::with('options')->findOrFail($validated['question_id']);
        $correctOption = $question->options->firstWhere('is_correct', true);
        $selectedOption = $question->options->firstWhere('id', $validated['selected_option_id']);
        
        $isCorrect = $selectedOption ? (bool) $selectedOption->is_correct : false;

        return response()->json([
            'success' => true,
            'is_correct' => $isCorrect,
            'correct_option_id' => $correctOption?->id,
            'explanation' => $question->explanation,
        ]);
    }

    /**
     * Start an exam simulation session (or Practice session).
     */
    public function startSimulation(StartExamSimulationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = Auth::user() ?? $request->user();
        $isGuest = !$user;

        $totalQuestions = $isGuest
            ? min((int) ($validated['total_questions'] ?? 20), 20)
            : min((int) ($validated['total_questions'] ?? 40), 100);

        $simulationId = null;

        if ($user) {
            $simulation = ExamSimulation::create([
                'user_id' => $user->id,
                'school_id' => $user->school_id ?? null,
                'exam_code' => strtolower($validated['exam_code']),
                'exam_year' => $validated['exam_year'] ?? null,
                'subject_ids' => $validated['subject_ids'] ?? [],
                'mode' => $validated['mode'] ?? 'simulation',
                'total_questions' => $totalQuestions,
                'duration_seconds' => $validated['duration_seconds'] ?? 2400, // 40 mins default
                'status' => 'in_progress',
            ]);
            $simulationId = $simulation->id;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'simulation_id' => $simulationId,
                'exam_code' => strtolower($validated['exam_code']),
                'mode' => $validated['mode'] ?? 'simulation',
                'duration_seconds' => $validated['duration_seconds'] ?? 2400,
                'is_guest' => $isGuest,
                'total_questions' => $totalQuestions,
            ],
        ]);
    }

    /**
     * Submit an exam simulation, compute score, and update topic mastery.
     */
    public function submitSimulation(SubmitExamSimulationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = Auth::user() ?? $request->user();
        $answers = $validated['answers'] ?? [];
        $timeSpent = $validated['time_spent_seconds'] ?? 0;

        $questionIds = !empty($validated['question_ids'])
            ? $validated['question_ids']
            : array_keys($answers);

        $questions = PastQuestion::with(['options', 'topic.subject', 'subject'])
            ->whereIn('id', $questionIds)
            ->get()
            ->keyBy('id');

        $totalQuestions = count($questionIds);
        $correctAnswers = 0;
        $detailedResults = [];
        $topicStats = []; // [topic_id => ['name' => ..., 'subject' => ..., 'total' => ..., 'correct' => ...]]

        foreach ($questionIds as $qId) {
            $question = $questions->get($qId);
            if (!$question) continue;

            $selectedOptId = $answers[$qId] ?? null;
            $correctOption = $question->options->firstWhere('is_correct', true);
            $selectedOption = $selectedOptId ? $question->options->firstWhere('id', $selectedOptId) : null;

            $isCorrect = ($correctOption && $selectedOptId && (int)$correctOption->id === (int)$selectedOptId);
            if ($isCorrect) {
                $correctAnswers++;
            }

            // Topic aggregation
            $topicId = $question->topic_id;
            $topicName = $question->topic?->name ?? 'General Assessment';
            $subjectName = $question->subject?->name ?? $question->topic?->subject?->name ?? 'General';

            if ($topicId) {
                if (!isset($topicStats[$topicId])) {
                    $topicStats[$topicId] = [
                        'topic_id' => $topicId,
                        'topic_name' => $topicName,
                        'subject_name' => $subjectName,
                        'total' => 0,
                        'correct' => 0,
                    ];
                }
                $topicStats[$topicId]['total']++;
                if ($isCorrect) {
                    $topicStats[$topicId]['correct']++;
                }
            }

            $detailedResults[] = [
                'question_id' => $question->id,
                'question_number' => $question->question_number,
                'question_text' => $question->question_text,
                'passage_text' => $question->passage_text,
                'image_url' => $question->image_url,
                'explanation' => $question->explanation,
                'topic' => [
                    'id' => $topicId,
                    'name' => $topicName,
                ],
                'subject' => [
                    'name' => $subjectName,
                ],
                'selected_option_id' => $selectedOptId,
                'selected_option_text' => $selectedOption?->option_text,
                'correct_option_id' => $correctOption?->id,
                'correct_option_text' => $correctOption?->option_text,
                'is_correct' => $isCorrect,
                'options' => $question->options->map(function ($opt, $idx) use ($selectedOptId) {
                    $letter = $opt->option_key ?: chr(65 + $idx);
                    return [
                        'id' => $opt->id,
                        'key' => strtolower($letter),
                        'label' => $letter,
                        'option_text' => $opt->option_text,
                        'is_correct' => $opt->is_correct,
                        'is_selected' => ($selectedOptId && (int)$opt->id === (int)$selectedOptId),
                    ];
                }),
            ];
        }

        $scorePercentage = $totalQuestions > 0
            ? round(($correctAnswers / $totalQuestions) * 100, 2)
            : 0;

        // Process topic mastery and weakness recommendations
        $topicBreakdown = [];
        $weakTopics = [];

        foreach ($topicStats as $tId => $stat) {
            $accuracy = round(($stat['correct'] / $stat['total']) * 100, 1);
            $breakdownItem = [
                'topic_id' => $tId,
                'topic_name' => $stat['topic_name'],
                'subject_name' => $stat['subject_name'],
                'total' => $stat['total'],
                'correct' => $stat['correct'],
                'accuracy' => $accuracy,
                'status' => $accuracy >= 70 ? 'strong' : ($accuracy >= 40 ? 'moderate' : 'weak'),
            ];
            $topicBreakdown[] = $breakdownItem;

            if ($accuracy < 60) {
                $weakTopics[] = $breakdownItem;
            }

            // Update user learner_progress topic mastery if user exists
            if ($user && $tId) {
                $progress = LearnerProgress::firstOrNew([
                    'user_id' => $user->id,
                    'topic_id' => $tId,
                ]);

                $prevAttempted = (int) ($progress->questions_attempted ?? 0);
                $prevCorrect   = (int) ($progress->questions_correct ?? 0);
                $newAttempted  = $prevAttempted + (int) ($stat['total'] ?? 0);
                $newCorrect    = $prevCorrect + (int) ($stat['correct'] ?? 0);

                $progress->questions_attempted = $newAttempted;
                $progress->questions_correct   = $newCorrect;
                $progress->mastery_score       = $newAttempted > 0 ? (int) round(($newCorrect / $newAttempted) * 100) : 0;
                $progress->last_attempted_at   = now();
                $progress->save();
            }
        }

        // Update or create simulation record
        if (!empty($validated['simulation_id'])) {
            $simulation = ExamSimulation::find($validated['simulation_id']);
            if ($simulation) {
                $simulation->update([
                    'total_questions' => $totalQuestions,
                    'correct_answers' => $correctAnswers,
                    'score_percentage' => $scorePercentage,
                    'time_spent_seconds' => $timeSpent,
                    'status' => 'completed',
                    'answers' => $answers,
                    'topic_breakdown' => $topicBreakdown,
                    'completed_at' => now(),
                ]);
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'exam_code' => $validated['exam_code'],
                'exam_year' => $validated['exam_year'] ?? null,
                'total_questions' => $totalQuestions,
                'correct_answers' => $correctAnswers,
                'wrong_answers' => $totalQuestions - $correctAnswers,
                'score_percentage' => $scorePercentage,
                'time_spent_seconds' => $timeSpent,
                'topic_breakdown' => $topicBreakdown,
                'weak_topics' => $weakTopics,
                'detailed_results' => $detailedResults,
            ],
        ]);
    }

    /**
     * Get previous simulation attempts.
     */
    public function getHistory(Request $request): JsonResponse
    {
        $user = Auth::user() ?? $request->user();
        if (!$user) {
            return response()->json(['success' => true, 'data' => []]);
        }

        $history = ExamSimulation::where('user_id', $user->id)
            ->where('status', 'completed')
            ->orderBy('completed_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'success' => true,
            'data' => $history,
        ]);
    }

    /**
     * Get an AI tutor explanation for a specific past question.
     */
    public function explain(ExplainPastQuestionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $pastQuestion = PastQuestion::with(['options', 'subject', 'topic'])->findOrFail($validated['past_question_id']);
        $selectedOptionId = $validated['selected_option_id'] ?? null;

        $explanation = $this->aiService->explainPastQuestion($pastQuestion, $selectedOptionId);

        return response()->json([
            'success' => true,
            'explanation' => $explanation,
        ]);
    }

    /**
     * Get a similar past examination question for practice.
     */
    public function getSimilar(Request $request): JsonResponse
    {
        $baseQuestionId = $request->input('past_question_id');
        $topicId = $request->input('topic_id');
        $subjectId = $request->input('subject_id');
        $examCode = $request->input('exam_code');
        $excludeIds = (array) $request->input('exclude_ids', []);

        if ($baseQuestionId) {
            $excludeIds[] = (int) $baseQuestionId;
            $baseQuestion = PastQuestion::with(['subject', 'topic'])->find($baseQuestionId);
            if ($baseQuestion) {
                $topicId = $topicId ?: $baseQuestion->topic_id;
                $subjectId = $subjectId ?: $baseQuestion->subject_id;
                $examCode = $examCode ?: $baseQuestion->exam_code;
            }
        }

        $query = PastQuestion::with(['options', 'subject', 'topic']);

        if (!empty($excludeIds)) {
            $query->whereNotIn('id', array_unique($excludeIds));
        }

        if ($topicId) {
            $query->where('topic_id', $topicId);
        } elseif ($subjectId) {
            $query->where('subject_id', $subjectId);
        }

        if ($examCode) {
            $query->where('exam_code', $examCode);
        }

        $question = (clone $query)->inRandomOrder()->first();

        // Fallback: relax topic filter to subject
        if (!$question && $topicId && $subjectId) {
            $fallbackQuery = PastQuestion::with(['options', 'subject', 'topic'])
                ->where('subject_id', $subjectId);
            if ($examCode) {
                $fallbackQuery->where('exam_code', $examCode);
            }
            if (!empty($excludeIds)) {
                $fallbackQuery->whereNotIn('id', array_unique($excludeIds));
            }
            $question = $fallbackQuery->inRandomOrder()->first();
        }

        if (!$question) {
            return response()->json([
                'success' => false,
                'message' => 'No additional past questions found for this topic.',
                'question' => null,
            ]);
        }

        $subject = $question->subject ?? $question->topic?->subject;

        return response()->json([
            'success' => true,
            'question' => [
                'id' => $question->id,
                'exam_code' => $question->exam_code,
                'exam_display_name' => $question->exam_display_name,
                'exam_year' => $question->exam_year,
                'paper_type' => $question->paper_type,
                'question_number' => $question->question_number,
                'question_text' => $question->question_text,
                'passage_text' => $question->passage_text,
                'image_url' => $question->image_url,
                'difficulty' => $question->difficulty,
                'explanation' => $question->explanation,
                'topic' => [
                    'id' => $question->topic?->id,
                    'name' => $question->topic?->name,
                ],
                'subject' => [
                    'id' => $subject?->id,
                    'name' => $subject?->name,
                    'slug' => $subject?->slug,
                ],
                'options' => $question->options->map(function (PastQuestionOption $opt, $index) {
                    $letter = $opt->option_key ?: chr(65 + $index);
                    return [
                        'id' => $opt->id,
                        'key' => strtolower($letter),
                        'label' => $letter,
                        'option_text' => $opt->option_text,
                        'is_correct' => (bool) $opt->is_correct,
                    ];
                }),
            ],
        ]);
    }
}
