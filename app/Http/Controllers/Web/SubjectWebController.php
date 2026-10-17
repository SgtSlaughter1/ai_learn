<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\ClassModel;
use App\Models\LearnerProfile;
use App\Models\LearnerProgress;
use App\Models\Quiz;
use App\Models\School;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SubjectWebController extends Controller
{
    /**
     * Render the subjects catalog page.
     */
    public function showSubjectsPage(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user?->isAnyAdmin()) {
            return redirect('/admin/dashboard');
        }
        if ($user && $user->isLearner() && !$user->hasSchoolAccess()) {
            return redirect('/general-knowledge');
        }
        return Inertia::render('Subjects/Index');
    }

    /**
     * Backward-compatible alias for showSubjectsPage.
     */
    public function index(Request $request): Response|RedirectResponse
    {
        return $this->showSubjectsPage($request);
    }

    /**
     * Render the General Knowledge subjects catalog page.
     */
    public function showGeneralKnowledgePage(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user?->isAnyAdmin()) {
            return redirect('/admin/dashboard');
        }
        return Inertia::render('GeneralKnowledge/Index');
    }

    /**
     * Backward-compatible alias for showGeneralKnowledgePage.
     */
    public function generalKnowledge(Request $request): Response|RedirectResponse
    {
        return $this->showGeneralKnowledgePage($request);
    }

    /**
     * Render the single subject details and topics view.
     */
    public function showSubject(Request $request, string $slug): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user?->isAnyAdmin()) {
            return redirect('/admin/dashboard');
        }
        return Inertia::render('Subjects/Show', [
            'slug' => $slug,
        ]);
    }

    /**
     * Backward-compatible alias for showSubject.
     */
    public function show(Request $request, string $slug): Response|RedirectResponse
    {
        return $this->showSubject($request, $slug);
    }

    public function getSubjects(Request $request): JsonResponse
    {
        $user = $request->user();
        $classId = $request->get('class_id');
        $gradeLevel = $request->get('grade_level') ?? $request->get('level');
        $scope = $request->get('scope', 'school'); // 'school' | 'general'

        [
            $userSchoolId,
            $userSchoolName,
            $userClassId,
            $userClassWindowIds,
            $userGradeLevels
        ] = $this->resolveUserSchoolAndProgression($user);

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

        $topicsSummary = $this->fetchTopicsSummary($level, $scope, $userGradeLevels, $user);
        $subjects = $this->fetchScopeSubjects(
            $scope,
            $userSchoolId,
            $classId ? (int) $classId : null,
            $userClassWindowIds,
            $level,
            $userGradeLevels,
            $topicsSummary,
            $userClassId
        );
        $classes = $this->fetchCohortClasses($request->boolean('include_classes', false), $user, $userSchoolId, $userClassWindowIds);

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

    private function resolveUserSchoolAndProgression(?User $user): array
    {
        $userSchoolId = null;
        $userSchoolName = null;
        $userClassId = null;
        $userClassWindowIds = [];
        $userGradeLevels = [];

        if (!$user) {
            return [$userSchoolId, $userSchoolName, $userClassId, $userClassWindowIds, $userGradeLevels];
        }

        if ($user->learnerProfile && $user->learnerProfile->school_id) {
            $userSchoolId = $user->learnerProfile->school_id;
            $userSchoolName = $user->learnerProfile->school?->name;
        } elseif ($user->isSchoolAdmin()) {
            $school = $user->primarySchool();
            $userSchoolId = $school?->id;
            $userSchoolName = $school?->name;
        }

        if ($user->isLearner()) {
            $enrolledClass = DB::table('class_memberships as cm')
                ->join('classes as c', 'c.id', '=', 'cm.class_id')
                ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
                ->where('cm.user_id', $user->id)
                ->where('cm.role', 'learner')
                ->where('c.is_active', true)
                ->select(['c.id', 'c.school_id', 'c.name', 'c.grade_level', 'c.arm', 'c.section', 'c.program_id', 'p.name as program_name', 'p.code as program_code'])
                ->first();

            if ($enrolledClass) {
                $userClassId = $enrolledClass->id;
                if (!$userSchoolId) {
                    $userSchoolId = $enrolledClass->school_id;
                }

                $gradeOrder = ClassModel::GRADE_ORDER;

                $schoolClasses = DB::table('classes as c')
                    ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
                    ->where('c.school_id', $enrolledClass->school_id)
                    ->where('c.is_active', true)
                    ->when($enrolledClass->program_id, function ($q, $programId) {
                        $q->where(function ($sub) use ($programId) {
                            $sub->where('c.program_id', $programId)
                                ->orWhereNull('c.program_id');
                        });
                    }, function ($q) {
                        $q->whereNull('c.program_id');
                    })
                    ->orderBy('c.id')
                    ->select(['c.id', 'c.school_id', 'c.name', 'c.grade_level', 'c.arm', 'c.section', 'c.program_id', 'p.name as program_name', 'p.code as program_code'])
                    ->get()
                    ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                    ->values();

                if ($enrolledClass->program_id) {
                    $progressionClasses = $schoolClasses->where('program_id', $enrolledClass->program_id);
                } elseif (in_array(strtoupper($enrolledClass->grade_level ?? ''), ['JSS1', 'JSS2', 'JSS3'])) {
                    $progressionClasses = $schoolClasses->filter(fn ($c) => in_array(strtoupper($c->grade_level ?? ''), ['JSS1', 'JSS2', 'JSS3']));
                } elseif (in_array(strtoupper($enrolledClass->grade_level ?? ''), ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'])) {
                    $progressionClasses = $schoolClasses->filter(fn ($c) => in_array(strtoupper($c->grade_level ?? ''), ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6']));
                } else {
                    $progressionClasses = $schoolClasses;
                }

                if ($progressionClasses->isNotEmpty()) {
                    $userClassWindowIds = $progressionClasses->pluck('id')->all();
                    $userGradeLevels = $progressionClasses->pluck('grade_level')->filter()->unique()->map(fn ($g) => strtolower($g))->all();
                } else {
                    $userClassWindowIds = [$enrolledClass->id];
                    if ($enrolledClass->grade_level) {
                        $userGradeLevels = [strtolower($enrolledClass->grade_level)];
                    }
                }
            }
        }

        return [$userSchoolId, $userSchoolName, $userClassId, $userClassWindowIds, $userGradeLevels];
    }

    private function fetchTopicsSummary(?string $level, string $scope, array $userGradeLevels, ?User $user): Collection
    {
        $topicsSummaryQuery = DB::table('topics as t')
            ->leftJoin('learner_progress as lp', function ($join) use ($user) {
                $join->on('lp.topic_id', '=', 't.id');
                if ($user) {
                    $join->where('lp.user_id', '=', $user->id);
                }
            })
            ->where('t.status', 'active');

        if ($level) {
            $topicsSummaryQuery->where('t.level', $level);
        } elseif ($scope === 'general' && !empty($userGradeLevels)) {
            $topicsSummaryQuery->where(function ($q) use ($userGradeLevels) {
                $q->whereIn('t.level', $userGradeLevels)
                  ->orWhereNull('t.level');
            });
        }

        return $topicsSummaryQuery
            ->groupBy('t.subject_id')
            ->selectRaw('
                t.subject_id,
                COUNT(t.id) as total_topics,
                SUM(CASE WHEN lp.mastery_score >= 80 THEN 1 ELSE 0 END) as completed_topics
            ')
            ->get()
            ->keyBy('subject_id');
    }

    private function fetchScopeSubjects(
        string $scope,
        ?int $userSchoolId,
        ?int $classId,
        array $userClassWindowIds,
        ?string $level,
        array $userGradeLevels,
        Collection $topicsSummary,
        ?int $userClassId
    ): array {
        $subjectsQuery = DB::table('subjects as s')
            ->leftJoin('schools as sc', 'sc.id', '=', 's.school_id')
            ->leftJoin('classes as c', 'c.id', '=', 's.class_id')
            ->where('s.status', 'active')
            ->whereNull('s.deleted_at');

        if ($scope === 'school' && $userSchoolId) {
            $subjectsQuery->where('s.school_id', $userSchoolId);

            if ($classId) {
                $subjectsQuery->where(function ($q) use ($classId) {
                    $q->where('s.class_id', $classId)
                      ->orWhereNull('s.class_id');
                });
            } elseif (!empty($userClassWindowIds)) {
                $subjectsQuery->where(function ($q) use ($userClassWindowIds) {
                    $q->whereIn('s.class_id', $userClassWindowIds)
                      ->orWhereNull('s.class_id');
                });
            }
        } elseif ($scope === 'general') {
            $subjectsQuery->whereNull('s.school_id');

            if ($level) {
                if ($topicsSummary->isNotEmpty()) {
                    $subjectsQuery->whereIn('s.id', $topicsSummary->keys());
                } else {
                    return [];
                }
            } elseif (!empty($userGradeLevels)) {
                $subjectsQuery->where(function ($q) use ($topicsSummary, $userGradeLevels) {
                    if ($topicsSummary->isNotEmpty()) {
                        $q->whereIn('s.id', $topicsSummary->keys());
                    }
                    $q->orWhereNull('s.class_id');
                });
            }
        }

        return $subjectsQuery
            ->select([
                's.id',
                's.school_id',
                'sc.name as school_name',
                's.class_id',
                'c.name as class_name',
                'c.grade_level as class_grade_level',
                's.name',
                's.slug',
                's.description',
            ])
            ->orderBy('s.sort_order')
            ->orderBy('s.name')
            ->get()
            ->map(function ($subject) use ($topicsSummary, $userClassId) {
                $summary = $topicsSummary->get($subject->id);
                $totalTopics = (int) ($summary?->total_topics ?? 0);
                $completedTopics = (int) ($summary?->completed_topics ?? 0);

                $isMyClass = $userClassId && $subject->class_id === $userClassId;
                $isUpcomingCohort = $userClassId && $subject->class_id && ($subject->class_id !== $userClassId);

                return [
                    'id' => (int) $subject->id,
                    'school_id' => $subject->school_id ? (int) $subject->school_id : null,
                    'school_name' => $subject->school_name,
                    'class_id' => $subject->class_id ? (int) $subject->class_id : null,
                    'class_name' => $subject->class_name,
                    'class_grade_level' => $subject->class_grade_level,
                    'is_my_class' => $isMyClass,
                    'is_upcoming_cohort' => $isUpcomingCohort,
                    'is_general_knowledge' => is_null($subject->school_id),
                    'name' => $subject->name,
                    'slug' => $subject->slug,
                    'description' => $subject->description,
                    'progress_percent' => $totalTopics > 0 ? (int) round(($completedTopics / $totalTopics) * 100) : 0,
                    'topics_count' => $totalTopics,
                ];
            })
            ->values()
            ->all();
    }

    private function fetchCohortClasses(bool $includeClasses, ?User $user, ?int $userSchoolId, array $userClassWindowIds): array
    {
        if (!$includeClasses || !$user) {
            return [];
        }

        $gradeOrder = ClassModel::GRADE_ORDER;

        return DB::table('classes as c')
            ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
            ->where('c.is_active', true)
            ->when($userSchoolId, fn ($q) => $q->where('c.school_id', $userSchoolId))
            ->when(!empty($userClassWindowIds), fn ($q) => $q->whereIn('c.id', $userClassWindowIds))
            ->select([
                'c.id',
                'c.school_id',
                'c.name',
                'c.grade_level',
                'c.arm',
                'c.section',
                'c.program_id',
                'p.name as program_name',
                'p.code as program_code',
            ])
            ->orderBy('c.id')
            ->get()
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->map(fn ($c) => [
                'id' => (int) $c->id,
                'school_id' => $c->school_id ? (int) $c->school_id : null,
                'name' => $c->name,
                'grade_level' => $c->grade_level,
                'arm' => $c->arm,
                'section' => $c->section,
                'school_class_arm' => $c->arm ?? $c->section,
                'program_id' => $c->program_id ? (int) $c->program_id : null,
                'program' => $c->program_id ? [
                    'id' => (int) $c->program_id,
                    'name' => $c->program_name,
                    'code' => $c->program_code,
                ] : null,
            ])
            ->values()
            ->all();
    }

    public function getClasses(Request $request): JsonResponse
    {
        $user = $request->user();
        $schoolId = null;
        $userClassWindowIds = [];

        if ($user) {
            $schoolId = $user->managedSchoolId();

            if ($user->isLearner()) {
                $enrolledClass = DB::table('class_memberships as cm')
                    ->join('classes as c', 'c.id', '=', 'cm.class_id')
                    ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
                    ->where('cm.user_id', $user->id)
                    ->where('cm.role', 'learner')
                    ->where('c.is_active', true)
                    ->select(['c.id', 'c.school_id', 'c.name', 'c.grade_level', 'c.arm', 'c.section', 'c.program_id', 'p.name as program_name', 'p.code as program_code'])
                    ->first();

                if ($enrolledClass) {
                    $schoolId = $schoolId ?: $enrolledClass->school_id;
                    $gradeOrder = ClassModel::GRADE_ORDER;

                    $schoolClasses = DB::table('classes as c')
                        ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
                        ->where('c.school_id', $schoolId)
                        ->where('c.is_active', true)
                        ->when($enrolledClass->program_id, function ($q, $programId) {
                            $q->where(function ($sub) use ($programId) {
                                $sub->where('c.program_id', $programId)
                                    ->orWhereNull('c.program_id');
                            });
                        }, function ($q) {
                            $q->whereNull('c.program_id');
                        })
                        ->orderBy('c.id')
                        ->select(['c.id', 'c.school_id', 'c.name', 'c.grade_level', 'c.arm', 'c.section', 'c.program_id', 'p.name as program_name', 'p.code as program_code'])
                        ->get()
                        ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
                        ->values();

                    if ($enrolledClass->program_id) {
                        $progressionClasses = $schoolClasses->where('program_id', $enrolledClass->program_id);
                    } elseif (in_array(strtoupper($enrolledClass->grade_level ?? ''), ['JSS1', 'JSS2', 'JSS3'])) {
                        $progressionClasses = $schoolClasses->filter(fn ($c) => in_array(strtoupper($c->grade_level ?? ''), ['JSS1', 'JSS2', 'JSS3']));
                    } elseif (in_array(strtoupper($enrolledClass->grade_level ?? ''), ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6'])) {
                        $progressionClasses = $schoolClasses->filter(fn ($c) => in_array(strtoupper($c->grade_level ?? ''), ['PRI1', 'PRI2', 'PRI3', 'PRI4', 'PRI5', 'PRI6']));
                    } else {
                        $progressionClasses = $schoolClasses;
                    }

                    if ($progressionClasses->isNotEmpty()) {
                        $userClassWindowIds = $progressionClasses->pluck('id')->all();
                    } else {
                        $userClassWindowIds = [$enrolledClass->id];
                    }
                }
            }
        }

        $classesQuery = DB::table('classes as c')
            ->leftJoin('programs as p', 'p.id', '=', 'c.program_id')
            ->where('c.is_active', true)
            ->when($schoolId, fn ($q) => $q->where('c.school_id', $schoolId))
            ->when(!empty($userClassWindowIds), fn ($q) => $q->whereIn('c.id', $userClassWindowIds))
            ->select([
                'c.id',
                'c.school_id',
                'c.name',
                'c.grade_level',
                'c.arm',
                'c.section',
                'c.program_id',
                'p.name as program_name',
                'p.code as program_code',
            ])
            ->orderBy('c.id')
            ->get();

        $gradeOrder = ClassModel::GRADE_ORDER;
        $sortedClasses = $classesQuery
            ->sortBy(fn ($c) => $gradeOrder[strtoupper($c->grade_level ?? '')] ?? 99)
            ->map(fn ($c) => [
                'id' => (int) $c->id,
                'school_id' => $c->school_id ? (int) $c->school_id : null,
                'name' => $c->name,
                'grade_level' => $c->grade_level,
                'arm' => $c->arm,
                'section' => $c->section,
                'school_class_arm' => $c->arm ?? $c->section,
                'program_id' => $c->program_id ? (int) $c->program_id : null,
                'program' => $c->program_id ? [
                    'id' => (int) $c->program_id,
                    'name' => $c->program_name,
                    'code' => $c->program_code,
                ] : null,
            ])
            ->values();

        return response()->json([
            'classes' => $sortedClasses,
            'grade_options' => $user ? $user->gradeOptions() : [],
            'allowed_grade_levels' => $user ? $user->allowedGradeLevels() : [],
        ]);
    }

    public function getSubjectDetails(Request $request, string $slug): JsonResponse
    {
        $user = $request->user();
        $classId = $request->get('class_id');
        $gradeLevel = $request->get('grade_level') ?? $request->get('level');
        $scope = $request->get('scope', 'school');

        $userSchoolId = $user?->managedSchoolId();

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
        Gate::authorize('view', Subject::findOrFail($subject->id));

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
            })
            ->values()
            ->all();

        // 2. Quizzes query (supports school-specific and general knowledge quizzes)
        $quizQuery = DB::table('quizzes as q')
            ->join('quiz_questions as qq', 'qq.quiz_id', '=', 'q.id')
            ->join('questions as qn', 'qn.id', '=', 'qq.question_id')
            ->join('topics as t', 't.id', '=', 'qn.topic_id')
            ->leftJoin('question_options as qo', 'qo.question_id', '=', 'qn.id')
            ->where('t.subject_id', $subject->id)
            ->where('q.status', 'active')
            ->where('qn.status', 'active');

        // Quizzes (which include answer keys for offline grading) only from the user's own
        // school or global ones, whatever scope is requested. Platform admins see all.
        if (!$user?->can('manage-platform')) {
            $quizQuery->where(function ($q) use ($userSchoolId, $scope) {
                $q->whereNull('q.school_id');
                if ($scope === 'school' && $userSchoolId) {
                    $q->orWhere('q.school_id', $userSchoolId);
                }
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
            'qq.marks as question_marks',
            'qo.id as option_id',
            'qo.option_text',
            'qo.is_correct',
        ])
        ->orderBy('q.id')
        ->orderBy('qq.sort_order')
        ->orderBy('qo.sort_order')
        ->get();

        $isStaff = $user && method_exists($user, 'isAnyAdmin') ? ($user->isAnyAdmin() || $user->isTeacher()) : false;

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
                    'correct_option_id' => null,
                    // Marks in this quiz, so offline grading matches the server's.
                    'marks' => (int) ($row->question_marks ?? 1),
                    'options' => [],
                ];
            }

            if ($row->option_id !== null) {
                if ($row->is_correct) {
                    $groupedQuizzes[$row->quiz_id]['questions'][$row->question_id]['correct_option_id'] = (int) $row->option_id;
                }

                $optionData = [
                    'id' => (int) $row->option_id,
                    'option_text' => $row->option_text,
                ];
                if ($isStaff) {
                    $optionData['is_correct'] = (bool) $row->is_correct;
                }
                $groupedQuizzes[$row->quiz_id]['questions'][$row->question_id]['options'][] = $optionData;
            }
        }

        $formattedQuizzes = array_values(array_map(function ($q) {
            $q['questions'] = array_values(array_map(function ($question) {
                $correctOptId = $question['correct_option_id'] ?? null;
                $question['answer_hash'] = $correctOptId
                    ? hash('sha256', "acedrill_salt_q_{$question['id']}_opt_{$correctOptId}")
                    : null;
                unset($question['correct_option_id']);
                return $question;
            }, $q['questions']));
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
        Gate::authorize('view', $sub);

        $topics = $sub->topics()
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->get(['id', 'subject_id', 'name', 'slug', 'level', 'description', 'sort_order'])
            ->values()
            ->all();

        return response()->json([
            'topics' => $topics,
        ]);
    }
}
