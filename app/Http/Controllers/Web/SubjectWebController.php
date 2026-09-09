<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\School;
use App\Models\Subject;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SubjectWebController extends Controller
{
    public function index(Request $request): mixed
    {
        $user = $request->user();
        $role = $user?->role?->value ?? $user?->role;
        if (in_array($role, ['admin', 'super_admin', 'school_admin'], true)) {
            return redirect('/admin/dashboard');
        }
        if ($role === 'teacher') {
            return redirect('/teacher/dashboard');
        }
        return Inertia::render('Subjects/Index');
    }

    public function generalKnowledge(Request $request): mixed
    {
        $user = $request->user();
        $role = $user?->role?->value ?? $user?->role;
        if (in_array($role, ['admin', 'super_admin', 'school_admin'], true)) {
            return redirect('/admin/dashboard');
        }
        if ($role === 'teacher') {
            return redirect('/teacher/dashboard');
        }
        return Inertia::render('GeneralKnowledge/Index');
    }

    public function show(Request $request, string $slug): mixed
    {
        $user = $request->user();
        $role = $user?->role?->value ?? $user?->role;
        if (in_array($role, ['admin', 'super_admin', 'school_admin'], true)) {
            return redirect('/admin/dashboard');
        }
        if ($role === 'teacher') {
            return redirect('/teacher/dashboard');
        }
        return Inertia::render('Subjects/Show', [
            'slug' => $slug,
        ]);
    }

    public function getSubjects(Request $request): JsonResponse
    {
        $user = $request->user();
        $classId = $request->get('class_id');
        $gradeLevel = $request->get('grade_level') ?? $request->get('level');
        $scope = $request->get('scope', 'school'); // 'school' | 'general'

        // Determine user school if enrolled or managing
        $userSchoolId = null;
        $userSchoolName = null;
        if ($user) {
            if ($user->learnerProfile && $user->learnerProfile->school_id) {
                $userSchoolId = $user->learnerProfile->school_id;
                $userSchoolName = $user->learnerProfile->school?->name;
            } elseif ($user->isSchoolAdmin()) {
                $school = $user->primarySchool();
                $userSchoolId = $school?->id;
                $userSchoolName = $school?->name;
            }
        }

        // If user has no school assigned, default scope to 'general'
        if (!$userSchoolId && $scope === 'school') {
            $scope = 'general';
        }

        $selectedClass = null;
        if ($classId) {
            $selectedClass = DB::table('classes')->where('id', $classId)->first();
            if ($selectedClass && $selectedClass->grade_level && !$gradeLevel) {
                $gradeLevel = $selectedClass->grade_level;
            }
        }

        $level = $gradeLevel ? strtolower($gradeLevel) : null;

        // 1. Topics Summary with Progress
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

        // 2. Query Subjects
        $subjectsQuery = DB::table('subjects as s')
            ->leftJoin('schools as sc', 'sc.id', '=', 's.school_id')
            ->where('s.status', 'active');

        if ($scope === 'school' && $userSchoolId) {
            // Strictly filter by learner's school curriculum
            $subjectsQuery->where('s.school_id', $userSchoolId);
        }

        if ($level) {
            $subjectsQuery->whereIn('s.id', $topicsSummary->keys());
        }

        $subjects = $subjectsQuery
            ->select([
                's.id',
                's.school_id',
                'sc.name as school_name',
                's.name',
                's.slug',
                's.description',
            ])
            ->orderBy('s.sort_order')
            ->get()
            ->map(function ($subject) use ($topicsSummary) {
                $summary = $topicsSummary->get($subject->id);
                $totalTopics = (int) ($summary?->total_topics ?? 0);
                $completedTopics = (int) ($summary?->completed_topics ?? 0);

                return [
                    'id' => (int) $subject->id,
                    'school_id' => $subject->school_id ? (int) $subject->school_id : null,
                    'school_name' => $subject->school_name,
                    'is_general_knowledge' => is_null($subject->school_id),
                    'name' => $subject->name,
                    'slug' => $subject->slug,
                    'description' => $subject->description,
                    'progress_percent' => $totalTopics > 0 ? (int) round(($completedTopics / $totalTopics) * 100) : 0,
                    'topics_count' => $totalTopics,
                ];
            });

        // Classes for cohort switcher
        $classes = $request->boolean('include_classes', false) && $user
            ? DB::table('classes as c')
                ->where('c.is_active', true)
                ->when($userSchoolId, fn ($q) => $q->where('c.school_id', $userSchoolId))
                ->select(['c.id', 'c.name', 'c.grade_level', 'c.section'])
                ->orderBy('c.grade_level')
                ->orderBy('c.name')
                ->get()
            : [];

        return response()->json([
            'scope' => $scope,
            'user_school' => $userSchoolId ? [
                'id' => $userSchoolId,
                'name' => $userSchoolName,
            ] : null,
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
        $schoolId = null;
        if ($user) {
            $schoolId = $user->learnerProfile?->school_id ?? ($user->isSchoolAdmin() ? $user->primarySchool()?->id : null);
        }

        $classes = $user
            ? DB::table('classes as c')
                ->where('c.is_active', true)
                ->when($schoolId, fn ($q) => $q->where('c.school_id', $schoolId))
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
        $scope = $request->get('scope', 'school');

        $userSchoolId = null;
        if ($user) {
            $userSchoolId = $user->learnerProfile?->school_id ?? ($user->isSchoolAdmin() ? $user->primarySchool()?->id : null);
        }

        if ($classId && !$gradeLevel) {
            $selectedClass = ClassModel::find($classId);
            if ($selectedClass && $selectedClass->grade_level) {
                $gradeLevel = $selectedClass->grade_level;
            }
        }
        $level = $gradeLevel ? strtolower($gradeLevel) : null;

        $subject = DB::table('subjects as s')
            ->leftJoin('schools as sc', 'sc.id', '=', 's.school_id')
            ->where('s.slug', $slug)
            ->where('s.status', 'active')
            ->select([
                's.id',
                's.school_id',
                'sc.name as school_name',
                's.name',
                's.slug',
                's.description',
            ])
            ->first();

        if (!$subject) {
            return response()->json(['message' => 'Subject not found'], 404);
        }

        // 1. Efficient single-join query for topics and user progress
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

        // 2. Quizzes query (supports school-specific and general knowledge quizzes)
        $quizQuery = DB::table('quizzes as q')
            ->join('quiz_questions as qq', 'qq.quiz_id', '=', 'q.id')
            ->join('questions as qn', 'qn.id', '=', 'qq.question_id')
            ->join('topics as t', 't.id', '=', 'qn.topic_id')
            ->leftJoin('question_options as qo', 'qo.question_id', '=', 'qn.id')
            ->where('t.subject_id', $subject->id)
            ->where('q.status', 'active')
            ->where('qn.status', 'active');

        if ($scope === 'school' && $userSchoolId) {
            $quizQuery->where(function ($q) use ($userSchoolId) {
                $q->where('q.school_id', $userSchoolId)
                  ->orWhereNull('q.school_id');
            });
        }

        if ($level) {
            $quizQuery->where('t.level', $level);
        }

        $quizRows = $quizQuery->select([
            'q.id as quiz_id',
            'q.school_id as quiz_school_id',
            'q.title as quiz_title',
            'q.description as quiz_description',
            'q.time_limit_minutes',
            'qn.id as question_id',
            'qn.school_id as question_school_id',
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

        // 3. Assemble clean payload in memory
        $groupedQuizzes = [];
        foreach ($quizRows as $row) {
            if (!isset($groupedQuizzes[$row->quiz_id])) {
                $groupedQuizzes[$row->quiz_id] = [
                    'id' => (int) $row->quiz_id,
                    'school_id' => $row->quiz_school_id ? (int) $row->quiz_school_id : null,
                    'is_general_knowledge' => is_null($row->quiz_school_id),
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
                    'school_id' => $row->question_school_id ? (int) $row->question_school_id : null,
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
            'scope' => $scope,
            'subject' => [
                'id' => (int) $subject->id,
                'school_id' => $subject->school_id ? (int) $subject->school_id : null,
                'school_name' => $subject->school_name,
                'is_general_knowledge' => is_null($subject->school_id),
                'name' => $subject->name,
                'slug' => $subject->slug,
                'description' => $subject->description,
            ],
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
