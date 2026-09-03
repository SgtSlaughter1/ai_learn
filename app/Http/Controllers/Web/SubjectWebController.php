<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SubjectWebController extends Controller
{
    public function index(Request $request): Response
    {
        return Inertia::render('Subjects/Index');
    }

    public function show(Request $request, string $slug): Response
    {
        return Inertia::render('Subjects/Show', [
            'slug' => $slug,
        ]);
    }

    public function getSubjects(Request $request): JsonResponse
    {
        $user = $request->user();
        $classId = $request->get('class_id');
        $gradeLevel = $request->get('grade_level') ?? $request->get('level');

        $selectedClass = null;
        if ($classId) {
            $selectedClass = DB::table('classes')->where('id', $classId)->first();
            if ($selectedClass && $selectedClass->grade_level && !$gradeLevel) {
                $gradeLevel = $selectedClass->grade_level;
            }
        }

        $level = $gradeLevel ? strtolower($gradeLevel) : null;

        // 1. Query 1: Fast aggregate on indexed integer columns (topic_id, subject_id, user_id)
        $topicsSummary = DB::table('topics as t')
            ->leftJoin('learner_progress as lp', function ($join) use ($user) {
                $join->on('lp.topic_id', '=', 't.id');
                if ($user) {
                    $join->where('lp.user_id', '=', $user->id);
                }
            })
            ->where('t.status', 'active')
            ->when($level, fn ($q) => $q->where('t.level', $level))
            ->groupBy('t.subject_id')
            ->selectRaw('
                t.subject_id,
                COUNT(t.id) as total_topics,
                SUM(CASE WHEN lp.mastery_score >= 80 THEN 1 ELSE 0 END) as completed_topics
            ')
            ->get()
            ->keyBy('subject_id');

        // 2. Query 2: Fetch subjects metadata without heavy multi-table grouping
        $subjectsQuery = DB::table('subjects')
            ->where('status', 'active');

        if ($level) {
            $subjectsQuery->whereIn('id', $topicsSummary->keys());
        }

        $subjects = $subjectsQuery
            ->select(['id', 'name', 'slug', 'description'])
            ->orderBy('sort_order')
            ->get()
            ->map(function ($subject) use ($topicsSummary) {
                $summary = $topicsSummary->get($subject->id);
                $totalTopics = (int) ($summary?->total_topics ?? 0);
                $completedTopics = (int) ($summary?->completed_topics ?? 0);

                return [
                    'id' => (int) $subject->id,
                    'name' => $subject->name,
                    'slug' => $subject->slug,
                    'description' => $subject->description,
                    'progress_percent' => $totalTopics > 0 ? (int) round(($completedTopics / $totalTopics) * 100) : 0,
                    'topics_count' => $totalTopics,
                ];
            });

        $classes = $request->boolean('include_classes', false) && $user
            ? DB::table('classes as c')
                ->where('c.is_active', true)
                ->select(['c.id', 'c.name', 'c.grade_level', 'c.section'])
                ->orderBy('c.grade_level')
                ->orderBy('c.name')
                ->get()
            : [];

        return response()->json([
            'subjects' => $subjects,
            'classes' => $classes,
            'selected_class' => $selectedClass ? [
                'id' => $selectedClass->id,
                'name' => $selectedClass->name,
                'grade_level' => $selectedClass->grade_level,
            ] : null,
            'selected_level' => $level,
        ]);
    }

    public function getClasses(Request $request): JsonResponse
    {
        $user = $request->user();

        $classes = $user
            ? DB::table('classes as c')
                ->where('c.is_active', true)
                ->select(['c.id', 'c.name', 'c.grade_level', 'c.section'])
                ->orderBy('c.grade_level')
                ->orderBy('c.name')
                ->get()
            : [];

        return response()->json([
            'classes' => $classes,
        ]);
    }

    public function getSubjectDetails(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();
        $classId = $request->get('class_id');
        $gradeLevel = $request->get('grade_level') ?? $request->get('level');

        if ($classId && !$gradeLevel) {
            $selectedClass = ClassModel::find($classId);
            if ($selectedClass && $selectedClass->grade_level) {
                $gradeLevel = $selectedClass->grade_level;
            }
        }
        $level = $gradeLevel ? strtolower($gradeLevel) : null;

        $subject = DB::table('subjects')
            ->where('slug', $slug)
            ->where('status', 'active')
            ->select(['id', 'name', 'slug', 'description'])
            ->first();

        if (!$subject) {
            return response()->json(['message' => 'Subject not found'], 404);
        }

        // 1. Efficient single-join query for topics and user progress (eliminates N+1)
        $topics = DB::table('topics as t')
            ->leftJoin('learner_progress as lp', function ($join) use ($user) {
                $join->on('lp.topic_id', '=', 't.id');
                if ($user) {
                    $join->where('lp.user_id', '=', $user->id);
                }
            })
            ->where('t.subject_id', $subject->id)
            ->where('t.status', 'active')
            ->when($level, fn ($q) => $q->where('t.level', $level))
            ->orderBy('t.sort_order')
            ->select([
                't.id',
                't.subject_id',
                't.name',
                't.slug',
                't.level',
                't.description',
                'lp.questions_attempted',
                'lp.questions_correct',
                'lp.mastery_score',
            ])
            ->get()
            ->map(function ($t) {
                return [
                    'id' => (int) $t->id,
                    'subject_id' => (int) $t->subject_id,
                    'name' => $t->name,
                    'slug' => $t->slug,
                    'level' => $t->level,
                    'description' => $t->description,
                    'progress' => $t->mastery_score !== null ? [
                        'questions_attempted' => (int) $t->questions_attempted,
                        'questions_correct' => (int) $t->questions_correct,
                        'mastery_score' => (int) $t->mastery_score,
                    ] : null,
                ];
            });

        // 2. High-performance single-pass DB query (zero whereIn, zero N+1, single roundtrip)
        $quizRows = DB::table('quizzes as q')
            ->join('quiz_questions as qq', 'qq.quiz_id', '=', 'q.id')
            ->join('questions as qn', 'qn.id', '=', 'qq.question_id')
            ->join('topics as t', 't.id', '=', 'qn.topic_id')
            ->leftJoin('question_options as qo', 'qo.question_id', '=', 'qn.id')
            ->where('t.subject_id', $subject->id)
            ->where('q.status', 'active')
            ->where('qn.status', 'active')
            ->when($level, fn ($q) => $q->where('t.level', $level))
            ->select([
                'q.id as quiz_id',
                'q.title as quiz_title',
                'q.description as quiz_description',
                'q.time_limit_minutes',
                'qn.id as question_id',
                'qn.topic_id',
                'qn.question_text',
                'qn.type',
                'qn.difficulty',
                'qn.explanation',
                'qo.id as option_id',
                'qo.option_text',
                'qo.is_correct',
            ])
            ->orderBy('q.id')
            ->orderBy('qq.sort_order')
            ->orderBy('qo.sort_order')
            ->get();

        // 3. Assemble clean payload in memory (single pass, zero Eloquent model overhead)
        $groupedQuizzes = [];
        foreach ($quizRows as $row) {
            if (!isset($groupedQuizzes[$row->quiz_id])) {
                $groupedQuizzes[$row->quiz_id] = [
                    'id' => (int) $row->quiz_id,
                    'subject_id' => (int) $subject->id,
                    'title' => $row->quiz_title,
                    'description' => $row->quiz_description,
                    'time_limit_minutes' => $row->time_limit_minutes !== null ? (int) $row->time_limit_minutes : null,
                    'questions' => [],
                ];
            }

            if (!isset($groupedQuizzes[$row->quiz_id]['questions'][$row->question_id])) {
                $groupedQuizzes[$row->quiz_id]['questions'][$row->question_id] = [
                    'id' => (int) $row->question_id,
                    'topic_id' => (int) $row->topic_id,
                    'question_text' => $row->question_text,
                    'type' => $row->type,
                    'difficulty' => $row->difficulty,
                    'explanation' => $row->explanation,
                    'options' => [],
                ];
            }

            if ($row->option_id !== null) {
                $groupedQuizzes[$row->quiz_id]['questions'][$row->question_id]['options'][] = [
                    'id' => (int) $row->option_id,
                    'option_text' => $row->option_text,
                    'is_correct' => (bool) $row->is_correct,
                ];
            }
        }

        $formattedQuizzes = array_values(array_map(function ($q) {
            $q['questions'] = array_values($q['questions']);
            return $q;
        }, $groupedQuizzes));

        return response()->json([
            'subject' => $subject,
            'topics' => $topics,
            'quizzes' => $formattedQuizzes,
        ]);
    }

    /**
     * Get topics for a specific subject (by ID or slug).
     */
    public function getTopics(Request $request, string $subject): JsonResponse
    {
        $sub = is_numeric($subject)
            ? Subject::find($subject)
            : Subject::where('slug', $subject)->first();

        if (!$sub) {
            return response()->json(['message' => 'Subject not found'], 404);
        }

        $topics = $sub->topics()
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->get(['id', 'subject_id', 'name', 'slug', 'level', 'description', 'sort_order']);

        return response()->json([
            'topics' => $topics,
        ]);
    }
}
