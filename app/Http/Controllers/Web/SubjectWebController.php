<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
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

        // Fetch active subjects and calculate progress percentages for this learner
        $subjects = Subject::where('status', 'active')
            ->select(['id', 'name', 'slug', 'description'])
            ->orderBy('sort_order')
            ->get()
            ->map(function ($subject) use ($user) {
                $totalTopics = $subject->topics()->count();
                $completedTopics = LearnerProgress::where('user_id', $user->id)
                    ->whereIn('topic_id', $subject->topics()->pluck('id'))
                    ->where('mastery_score', '>=', 80)
                    ->count();
                
                return [
                    'id' => $subject->id,
                    'name' => $subject->name,
                    'slug' => $subject->slug,
                    'description' => $subject->description,
                    'progress_percent' => $totalTopics > 0 ? round(($completedTopics / $totalTopics) * 100) : 0,
                    'topics_count' => $totalTopics,
                ];
            });

        return response()->json([
            'subjects' => $subjects,
        ]);
    }

    public function getSubjectDetails(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();

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
                $join->on('lp.topic_id', '=', 't.id')
                     ->where('lp.user_id', '=', $user->id);
            })
            ->where('t.subject_id', $subject->id)
            ->where('t.status', 'active')
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
}
