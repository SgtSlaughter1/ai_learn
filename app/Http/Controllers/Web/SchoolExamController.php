<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\SchoolExam\ExtendSchoolExamAttemptRequest;
use App\Http\Requests\SchoolExam\SaveSchoolExamRequest;
use App\Models\ClassModel;
use App\Models\Question;
use App\Models\SchoolExam;
use App\Models\SchoolExamAttempt;
use App\Models\Subject;
use App\Models\User;
use App\Services\SchoolExams\SchoolExamService;
use App\Support\ListSize;
use App\Support\SearchTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * School CBT, staff side: set exams, run the exam room, and see and release results.
 * Learners take them through LearnerExamController.
 */
class SchoolExamController extends Controller
{
    public function __construct(private SchoolExamService $exams) {}

    public function index(Request $request): Response|RedirectResponse
    {
        $user = $request->user();
        if ($user->isLearner()) {
            return redirect('/exams');
        }

        $exams = SchoolExam::visibleToStaff($user)
            ->select([
                'id', 'school_id', 'subject_id', 'title', 'duration_minutes', 'opens_at', 'closes_at',
                'status', 'question_count', 'total_marks', 'results_released_at',
            ])
            ->with(['subject:id,name', 'classes:classes.id,name'])
            ->withCount([
                'attempts as started_count',
                'attempts as submitted_count' => fn ($q) => $q->where('status', '!=', SchoolExamAttempt::STATUS_IN_PROGRESS),
            ])
            ->orderByDesc('opens_at')
            ->paginate(ListSize::from($request->query('per_page'), 20, 50));

        return Inertia::render('SchoolExams/Index', [
            'exams' => $exams->through(fn (SchoolExam $exam) => $this->summary($exam)),
            'canCreate' => $user->can('create', SchoolExam::class),
            'cbtEnabled' => $user->cbtEnabled(),
            'options' => $user->can('create', SchoolExam::class) ? $this->builderOptions($user, $user->managedSchoolId()) : null,
        ]);
    }

    public function show(Request $request, SchoolExam $exam): Response
    {
        Gate::authorize('manage', $exam);
        $exam->load(['subject:id,name', 'classes:classes.id,name']);

        return Inertia::render('SchoolExams/Show', [
            'exam' => $this->summary($exam) + [
                'instructions' => $exam->instructions,
                'pass_mark' => $exam->pass_mark,
                'shuffle_questions' => $exam->shuffle_questions,
                'shuffle_options' => $exam->shuffle_options,
                'show_score_immediately' => $exam->show_score_immediately,
                'access_code' => $exam->isDraft() ? null : $exam->access_code,
                'has_attempts' => $exam->attempts()->exists(),
            ],
            'options' => $this->builderOptions($request->user(), $exam->school_id),
        ]);
    }

    /** The exam as the builder edits it: settings, classes and questions in order. */
    public function edit(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);

        $questions = $exam->examQuestions()
            ->join('questions', 'questions.id', '=', 'school_exam_questions.question_id')
            ->leftJoin('topics', 'topics.id', '=', 'questions.topic_id')
            ->get([
                'school_exam_questions.question_id as id', 'school_exam_questions.marks',
                'questions.question_text', 'questions.difficulty', 'topics.name as topic_name',
            ]);

        return response()->json([
            'exam' => $exam->only([
                'id', 'school_id', 'subject_id', 'title', 'instructions', 'duration_minutes', 'pass_mark',
                'shuffle_questions', 'shuffle_options', 'show_score_immediately',
            ]) + [
                'opens_at' => $exam->opens_at->toIso8601String(),
                'closes_at' => $exam->closes_at->toIso8601String(),
                'class_ids' => $exam->classes()->pluck('classes.id'),
                'questions' => $questions,
            ],
        ]);
    }

    /** Questions to pick from, lean: no options or passages, paginated. */
    public function questionBank(Request $request): JsonResponse
    {
        $query = Question::forUser($request->user())
            ->where('questions.status', 'active')
            ->whereIn('questions.type', SchoolExam::QUESTION_TYPES)
            ->leftJoin('topics', 'topics.id', '=', 'questions.topic_id')
            ->select(['questions.id', 'questions.question_text', 'questions.difficulty', 'questions.marks', 'topics.name as topic_name']);

        if ($request->filled('topic_id')) {
            $query->where('questions.topic_id', $request->integer('topic_id'));
        } elseif ($request->filled('subject_id')) {
            $query->where('topics.subject_id', $request->integer('subject_id'));
        }
        if ($request->filled('difficulty')) {
            $query->where('questions.difficulty', $request->string('difficulty'));
        }
        if ($request->filled('search')) {
            $query->where('questions.question_text', 'like', SearchTerm::like($request->string('search')));
        }

        // "Add 10 random": a draw from the current filter, skipping questions already on the exam.
        if ($request->filled('random')) {
            $exclude = collect(explode(',', (string) $request->query('exclude', '')))->filter(fn ($id) => ctype_digit($id))->take(SaveSchoolExamRequest::MAX_QUESTIONS);

            return response()->json([
                'data' => $query->whereNotIn('questions.id', $exclude)->inRandomOrder()->limit(ListSize::from($request->query('random'), 10, 50))->get(),
            ]);
        }

        $page = $query->orderByDesc('questions.id')->paginate(ListSize::from($request->query('per_page'), 25, 100));

        return response()->json([
            'data' => $page->items(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    public function store(SaveSchoolExamRequest $request): JsonResponse
    {
        Gate::authorize('create', SchoolExam::class);
        $user = $request->user();
        $schoolId = $user->managedSchoolId();

        $exam = DB::transaction(function () use ($request, $user, $schoolId) {
            $exam = SchoolExam::create($this->settings($request, $user, $schoolId) + [
                'school_id' => $schoolId,
                'created_by' => $user->id,
                'status' => SchoolExam::STATUS_DRAFT,
            ]);
            $exam->classes()->sync($request->validated('class_ids'));
            $this->exams->syncQuestions($exam, $request->validated('questions'), $user);

            return $exam;
        });

        return response()->json(['message' => 'Exam saved as a draft.', 'id' => $exam->id], 201);
    }

    public function update(SaveSchoolExamRequest $request, SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        $user = $request->user();

        // Once anyone has started, the paper and timing are fixed; the window and wording can still change.
        if ($exam->attempts()->exists()) {
            $exam->update($request->safe()->only(['title', 'instructions', 'closes_at', 'show_score_immediately']));

            return response()->json(['message' => 'Saved. Learners have started, so only the title, instructions, closing time and score setting changed.']);
        }

        DB::transaction(function () use ($request, $user, $exam) {
            $exam->update($this->settings($request, $user, $exam->school_id));
            $exam->classes()->sync($request->validated('class_ids'));
            $this->exams->syncQuestions($exam, $request->validated('questions'), $user);
        });

        return response()->json(['message' => 'Exam saved.']);
    }

    public function destroy(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        abort_if($exam->attempts()->exists(), 422, 'Learners have sat this exam, so it can\'t be deleted. Close it instead.');

        $exam->delete();

        return response()->json(['message' => 'Exam deleted.']);
    }

    public function publish(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        abort_unless($exam->isDraft(), 422, 'This exam is already published.');
        abort_if($exam->question_count === 0, 422, 'Add questions before publishing.');
        abort_if($exam->closes_at->isPast(), 422, 'The closing time has passed. Change it before publishing.');

        $exam->update(['status' => SchoolExam::STATUS_PUBLISHED, 'access_code' => SchoolExam::newAccessCode()]);

        return response()->json(['message' => 'Published. Read the start code out in the exam room.', 'access_code' => $exam->access_code]);
    }

    /** End the exam for everyone now; anyone still writing is submitted as they are. */
    public function close(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        abort_if($exam->isDraft(), 422, 'A draft has nothing to close.');

        $exam->update(['status' => SchoolExam::STATUS_CLOSED]);
        SchoolExamAttempt::where('school_exam_id', $exam->id)
            ->where('status', SchoolExamAttempt::STATUS_IN_PROGRESS)
            ->select(['id'])
            ->chunkById(100, fn ($attempts) => $attempts->each(fn ($a) => $this->exams->finish($a, SchoolExamAttempt::STATUS_AUTO_SUBMITTED)));

        return response()->json(['message' => 'Exam closed. Everyone still writing was submitted.']);
    }

    /** The exam room: every learner who should sit it, and how far they are. Polled by the invigilator. */
    public function monitor(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        $this->exams->closeOverdue($exam);

        $roster = $this->roster($exam, [
            'a.id as attempt_id', 'a.status', 'a.answered_count', 'a.left_screen_count', 'a.extra_minutes',
            'a.started_at', 'a.deadline_at', 'a.submitted_at',
        ]);

        return response()->json([
            'status' => $this->displayStatus($exam),
            'question_count' => $exam->question_count,
            'server_time' => now()->toIso8601String(),
            'learners' => $roster,
        ]);
    }

    public function results(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        $this->exams->closeOverdue($exam);

        $roster = $this->roster($exam, ['a.status', 'a.score', 'a.max_score', 'a.percentage', 'a.left_screen_count', 'a.submitted_at', 'a.topic_breakdown']);

        // Class-wide topic scores in marks, from each attempt's breakdown.
        $topics = [];
        foreach ($roster as $row) {
            foreach (json_decode($row->topic_breakdown ?? '[]', true) ?: [] as $topic) {
                $key = $topic['topic_id'];
                $topics[$key] ??= ['topic_id' => $key, 'name' => $topic['name'], 'marks' => 0, 'max_marks' => 0];
                $topics[$key]['marks'] += $topic['marks'];
                $topics[$key]['max_marks'] += $topic['max_marks'];
            }
            unset($row->topic_breakdown);
        }
        $topics = collect($topics)
            ->map(fn ($t) => $t + ['accuracy' => $t['max_marks'] > 0 ? round($t['marks'] / $t['max_marks'] * 100) : 0])
            ->sortBy('accuracy')
            ->values();

        $marked = $roster->whereNotNull('percentage');

        return response()->json([
            'released_at' => $exam->results_released_at?->toIso8601String(),
            'pass_mark' => $exam->pass_mark,
            'summary' => [
                'expected' => $roster->count(),
                'sat' => $marked->count(),
                'average' => $marked->isNotEmpty() ? round($marked->avg('percentage'), 1) : null,
                'highest' => $marked->max('percentage'),
                'lowest' => $marked->min('percentage'),
                'passed' => $exam->pass_mark !== null ? $marked->where('percentage', '>=', $exam->pass_mark)->count() : null,
            ],
            'topics' => $topics,
            'learners' => $roster,
        ]);
    }

    public function exportResults(SchoolExam $exam): StreamedResponse
    {
        Gate::authorize('manage', $exam);
        $this->exams->closeOverdue($exam);
        $roster = $this->roster($exam, ['a.status', 'a.score', 'a.max_score', 'a.percentage', 'a.left_screen_count', 'a.submitted_at']);

        $filename = str($exam->title)->slug().'-results.csv';

        return response()->streamDownload(function () use ($roster) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Learner', 'Class', 'Status', 'Score', 'Out of', 'Percent', 'Left exam screen', 'Submitted at']);
            foreach ($roster as $row) {
                fputcsv($out, [
                    $row->name, $row->class_name, $row->status ?? 'not started', $row->score, $row->max_score,
                    $row->percentage, $row->left_screen_count, $row->submitted_at,
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function release(SchoolExam $exam): JsonResponse
    {
        Gate::authorize('manage', $exam);
        abort_if($exam->isDraft(), 422, 'Publish the exam first.');
        abort_if($exam->resultsReleased(), 422, 'Results are already released.');
        abort_if($exam->closes_at->isFuture() && $exam->status !== SchoolExam::STATUS_CLOSED, 422, 'Release results after the exam closes, so nobody still writing sees the answers.');

        $this->exams->releaseResults($exam);

        return response()->json(['message' => 'Results released. Learners can see their corrections.']);
    }

    public function extend(ExtendSchoolExamAttemptRequest $request, SchoolExamAttempt $attempt): JsonResponse
    {
        Gate::authorize('manage', $attempt->exam);
        abort_unless($attempt->isInProgress(), 422, 'This learner has already finished.');

        $minutes = $request->integer('minutes');
        $attempt->update([
            'extra_minutes' => $attempt->extra_minutes + $minutes,
            'deadline_at' => $attempt->deadline_at->copy()->addMinutes($minutes),
        ]);

        return response()->json(['message' => "Added {$minutes} min.", 'deadline_at' => $attempt->deadline_at->toIso8601String()]);
    }

    public function end(SchoolExamAttempt $attempt): JsonResponse
    {
        Gate::authorize('manage', $attempt->exam);
        abort_unless($attempt->isInProgress(), 422, 'This learner has already finished.');

        $this->exams->finish($attempt, SchoolExamAttempt::STATUS_ENDED);

        return response()->json(['message' => 'Ended. Their answers so far were submitted.']);
    }

    /** One row per learner in the exam's classes, with their attempt's columns (null when not started). */
    private function roster(SchoolExam $exam, array $attemptColumns)
    {
        return DB::table('class_memberships as m')
            ->join('school_exam_classes as ec', 'ec.class_id', '=', 'm.class_id')
            ->join('users', 'users.id', '=', 'm.user_id')
            ->join('classes', 'classes.id', '=', 'm.class_id')
            ->leftJoin('school_exam_attempts as a', fn ($join) => $join->on('a.user_id', '=', 'm.user_id')->where('a.school_exam_id', '=', $exam->id))
            ->where('ec.school_exam_id', $exam->id)
            ->where('m.role', 'learner')
            ->where('m.is_active', true)
            ->orderBy('users.name')
            ->get(array_merge(['users.id as user_id', 'users.name', 'classes.name as class_name'], $attemptColumns))
            ->unique('user_id') // a learner in two of the exam's classes sits it once
            ->each(function ($row) {
                if (property_exists($row, 'percentage') && $row->percentage !== null) {
                    $row->percentage = (float) $row->percentage; // decimals come back from the database as strings
                }
            })
            ->values();
    }

    private function settings(SaveSchoolExamRequest $request, User $user, int $schoolId): array
    {
        $classIds = collect($request->validated('class_ids'));
        $allowedClasses = $this->assignableClasses($user, $schoolId)->pluck('id');
        if ($classIds->diff($allowedClasses)->isNotEmpty()) {
            throw ValidationException::withMessages(['class_ids' => 'You can only set exams for classes in your school that you manage or teach.']);
        }

        $subjectId = $request->validated('subject_id');
        if ($subjectId && ! Subject::whereKey($subjectId)->where(fn ($q) => $q->where('school_id', $schoolId)->orWhereNull('school_id'))->exists()) {
            throw ValidationException::withMessages(['subject_id' => 'Pick a subject from this school.']);
        }

        return $request->safe()->only([
            'subject_id', 'title', 'instructions', 'duration_minutes', 'opens_at', 'closes_at', 'pass_mark',
            'shuffle_questions', 'shuffle_options', 'show_score_immediately',
        ]);
    }

    /** Classes this person may set exams for: all of the school's for its admins, their own for teachers. */
    private function assignableClasses(User $user, int $schoolId)
    {
        return ClassModel::query()
            ->where('is_active', true)
            ->where('school_id', $schoolId)
            ->when(! $user->isAnyAdmin(), fn ($q) => $q->whereIn('id', $user->taughtClassIds()))
            ->orderBy('grade_level')
            ->orderBy('name')
            ->get(['id', 'name', 'grade_level', 'school_id']);
    }

    /** What the exam builder offers: classes and subjects. Questions load from questionBank(). */
    private function builderOptions(User $user, int $schoolId): array
    {
        $classes = $this->assignableClasses($user, $schoolId);

        return [
            'classes' => $classes,
            'subjects' => Subject::query()
                ->whereIn('class_id', $classes->pluck('id'))
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'class_id']),
        ];
    }

    private function summary(SchoolExam $exam): array
    {
        return [
            'id' => $exam->id,
            'title' => $exam->title,
            'subject' => $exam->subject?->name,
            'classes' => $exam->classes->pluck('name'),
            'duration_minutes' => $exam->duration_minutes,
            'opens_at' => $exam->opens_at->toIso8601String(),
            'closes_at' => $exam->closes_at->toIso8601String(),
            'status' => $this->displayStatus($exam),
            'question_count' => $exam->question_count,
            'total_marks' => $exam->total_marks,
            'results_released' => $exam->resultsReleased(),
            'started_count' => $exam->started_count ?? null,
            'submitted_count' => $exam->submitted_count ?? null,
        ];
    }

    /** draft, scheduled, open or ended, as the staff lists show it. */
    private function displayStatus(SchoolExam $exam): string
    {
        return match (true) {
            $exam->isDraft() => 'draft',
            $exam->status === SchoolExam::STATUS_CLOSED || $exam->closes_at->isPast() => 'ended',
            $exam->opens_at->isFuture() => 'scheduled',
            default => 'open',
        };
    }
}
