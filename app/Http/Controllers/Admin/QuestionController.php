<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\BulkSaveQuestionsRequest;
use App\Http\Requests\Admin\SaveQuestionRequest;
use App\Http\Requests\Admin\UpdateQuestionRequest;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\Subject;
use App\Models\Topic;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Schema;

class QuestionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Question::forUser($user)->where('status', '!=', 'archived')->with([
            'options',
            'topic.subject:id,name,slug,school_id,class_id',
            'topic.subject.schoolClass:id,name,grade_level',
            'school:id,name',
        ]);

        if ($request->filled('topic_id')) {
            $query->where('topic_id', $request->topic_id);
        } elseif ($request->filled('subject_id')) {
            $query->whereHas('topic', fn ($q) => $q->where('subject_id', $request->subject_id));
        } elseif ($request->filled('class_id')) {
            $query->whereHas('topic.subject', fn ($q) => $q->where('class_id', $request->class_id));
        }

        if ($request->filled('difficulty')) {
            $query->where('difficulty', $request->difficulty);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where('question_text', 'like', "%{$search}%");
        }

        if ($request->filled('per_page') && is_numeric($request->per_page)) {
            $perPage = max(1, min(100, (int) $request->per_page));
            $questions = $query->orderByDesc('id')->paginate($perPage);
            $items = $questions->items();
            $total = $questions->total();
            $this->withAbilities($items);
            $meta = [
                'current_page' => $questions->currentPage(),
                'last_page' => $questions->lastPage(),
                'per_page' => $questions->perPage(),
                'total' => $total,
            ];
        } else {
            $items = $query->orderByDesc('id')->get()->values()->all();
            $total = count($items);
            $this->withAbilities($items);
            $meta = [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => $total,
                'total' => $total,
            ];
        }

        return response()->json([
            'questions' => $items,
            'data' => $items,
            'pagination' => $meta,
            'meta' => $meta,
        ]);
    }

    public function store(SaveQuestionRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $topic = Topic::with('subject')->findOrFail($validated['topic_id']);
        Gate::authorize('create', [Question::class, $topic]);
        $schoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? $topic->subject?->school_id);

        $question = DB::transaction(function () use ($validated, $schoolId, $topic) {
            $assignedSchoolId = $schoolId;

            $hasMultipleCorrect = count(array_filter($validated['options'], fn ($o) => ! empty($o['is_correct']))) > 1;
            $type = $validated['type'] ?? ($hasMultipleCorrect ? 'multiple_select' : 'multiple_choice');
            $marks = (int) ($validated['marks'] ?? 1);
            $gradeLevel = $validated['grade_level'] ?? $topic?->level;

            $payload = [
                'topic_id' => $validated['topic_id'],
                'school_id' => $assignedSchoolId,
                'question_text' => $validated['question_text'],
                'image_url' => $validated['image_url'] ?? null,
                'type' => $type,
                'difficulty' => $validated['difficulty'] ?? 'medium',
                'explanation' => $validated['explanation'] ?? null,
                'status' => $validated['status'] ?? 'active',
            ];

            if (Schema::hasColumn('questions', 'marks')) {
                $payload['marks'] = $marks;
            }
            if (Schema::hasColumn('questions', 'grade_level')) {
                $payload['grade_level'] = $gradeLevel;
            }

            $question = Question::create($payload);

            foreach ($validated['options'] as $index => $opt) {
                QuestionOption::create([
                    'question_id' => $question->id,
                    'option_text' => $opt['option_text'],
                    'is_correct' => (bool) $opt['is_correct'],
                    'sort_order' => $opt['sort_order'] ?? $index,
                ]);
            }

            // Auto-link question to subject assessment quiz so learners can take it immediately
            if ($topic && $topic->subject) {
                $subjectName = $topic->subject->name;
                $quiz = Quiz::firstOrCreate(
                    [
                        'title' => "{$subjectName} Assessment & Practice",
                        'school_id' => $assignedSchoolId,
                    ],
                    [
                        'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                        'time_limit_minutes' => 30,
                        'status' => 'active',
                    ]
                );

                if (! $quiz->questions()->where('questions.id', $question->id)->exists()) {
                    $maxSort = (int) $quiz->questions()->max('quiz_questions.sort_order');
                    $quiz->questions()->attach($question->id, [
                        'sort_order' => $maxSort + 1,
                        'marks' => $marks,
                    ]);
                }
            }

            return $question;
        });

        return response()->json([
            'message' => 'Question created successfully',
            'question' => $question->load(['options', 'topic.subject:id,name', 'school:id,name']),
        ], 201);
    }

    public function bulkStore(BulkSaveQuestionsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $topic = Topic::with('subject')->findOrFail($validated['topic_id']);
        Gate::authorize('create', [Question::class, $topic]);
        $schoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? $topic->subject?->school_id);

        $createdQuestions = DB::transaction(function () use ($validated, $schoolId, $topic) {
            $assignedSchoolId = $schoolId;

            $results = [];

            // Prepare Quiz for auto-linking
            $quiz = null;
            if ($topic && $topic->subject) {
                $subjectName = $topic->subject->name;
                $quiz = Quiz::firstOrCreate(
                    [
                        'title' => "{$subjectName} Assessment & Practice",
                        'school_id' => $assignedSchoolId,
                    ],
                    [
                        'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                        'time_limit_minutes' => 30,
                        'status' => 'active',
                    ]
                );
            }

            foreach ($validated['questions'] as $qData) {
                $question = Question::create([
                    'topic_id' => $validated['topic_id'],
                    'school_id' => $assignedSchoolId,
                    'question_text' => $qData['question_text'],
                    'image_url' => $qData['image_url'] ?? null,
                    'type' => $qData['type'] ?? 'multiple_choice',
                    'difficulty' => $qData['difficulty'] ?? 'medium',
                    'explanation' => $qData['explanation'] ?? null,
                    'status' => $qData['status'] ?? 'active',
                ]);

                foreach ($qData['options'] as $index => $opt) {
                    QuestionOption::create([
                        'question_id' => $question->id,
                        'option_text' => $opt['option_text'],
                        'is_correct' => (bool) $opt['is_correct'],
                        'sort_order' => $opt['sort_order'] ?? $index,
                    ]);
                }

                if ($quiz && ! $quiz->questions()->where('questions.id', $question->id)->exists()) {
                    $maxSort = (int) $quiz->questions()->max('quiz_questions.sort_order');
                    $quiz->questions()->attach($question->id, [
                        'sort_order' => $maxSort + 1,
                        'marks' => 2,
                    ]);
                }

                $results[] = $question->load(['options', 'topic.subject:id,name', 'school:id,name']);
            }

            return $results;
        });

        return response()->json([
            'success' => true,
            'message' => count($createdQuestions).' questions imported successfully',
            'count' => count($createdQuestions),
            'questions' => $createdQuestions,
        ], 201);
    }

    public function update(UpdateQuestionRequest $request, int $id): JsonResponse
    {
        $question = Question::with('topic.subject')->findOrFail($id);
        Gate::authorize('update', $question);

        $validated = $request->validated();

        // Moving it to another topic needs the right to add questions there too.
        $newTopic = Topic::with('subject')->findOrFail($validated['topic_id']);
        Gate::authorize('create', [Question::class, $newTopic]);
        $schoolId = $request->user()->schoolForNewRecord($validated['school_id'] ?? $question->school_id ?? $newTopic->subject?->school_id);

        DB::transaction(function () use ($question, $validated, $schoolId, $newTopic) {
            $assignedSchoolId = $schoolId;

            $hasMultipleCorrect = ! empty($validated['options']) && count(array_filter($validated['options'], fn ($o) => ! empty($o['is_correct']))) > 1;
            $type = $validated['type'] ?? ($hasMultipleCorrect ? 'multiple_select' : $question->type);
            $marks = isset($validated['marks']) ? (int) $validated['marks'] : ($question->marks ?? 1);
            $gradeLevel = $validated['grade_level'] ?? $question->grade_level ?? $newTopic?->level;

            $updatePayload = [
                'topic_id' => $validated['topic_id'],
                'school_id' => $assignedSchoolId,
                'question_text' => $validated['question_text'],
                'image_url' => array_key_exists('image_url', $validated) ? $validated['image_url'] : $question->image_url,
                'type' => $type,
                'difficulty' => $validated['difficulty'] ?? $question->difficulty,
                'explanation' => $validated['explanation'] ?? null,
                'status' => $validated['status'] ?? $question->status,
            ];

            if (Schema::hasColumn('questions', 'marks')) {
                $updatePayload['marks'] = $marks;
            }
            if (Schema::hasColumn('questions', 'grade_level')) {
                $updatePayload['grade_level'] = $gradeLevel;
            }

            $question->update($updatePayload);

            $question->syncOptions($validated['options'] ?? []);

            // Ensure question is linked to the subject quiz
            if ($newTopic && $newTopic->subject) {
                $subjectName = $newTopic->subject->name;
                $quiz = Quiz::firstOrCreate(
                    [
                        'title' => "{$subjectName} Assessment & Practice",
                        'school_id' => $assignedSchoolId,
                    ],
                    [
                        'description' => "Comprehensive diagnostic assessment and practice exercises for {$subjectName}.",
                        'time_limit_minutes' => 30,
                        'status' => 'active',
                    ]
                );

                if (! $quiz->questions()->where('questions.id', $question->id)->exists()) {
                    $maxSort = (int) $quiz->questions()->max('quiz_questions.sort_order');
                    $quiz->questions()->attach($question->id, [
                        'sort_order' => $maxSort + 1,
                        'marks' => $marks,
                    ]);
                } else {
                    $quiz->questions()->updateExistingPivot($question->id, [
                        'marks' => $marks,
                    ]);
                }
            }
        });

        return response()->json([
            'message' => 'Question updated successfully',
            'question' => $question->fresh(['options', 'topic.subject:id,name', 'school:id,name']),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $question = Question::with('topic.subject')->findOrFail($id);
        Gate::authorize('delete', $question);

        // Learners' answers reference this question, so deleting it would break their
        // quiz history. Archive it instead: it disappears from the bank and from quizzes.
        if ($question->answers()->exists()) {
            DB::transaction(function () use ($question) {
                $question->update(['status' => 'archived']);
                $question->quizzes()->detach();
            });

            return response()->json(['message' => 'Question archived successfully', 'archived' => true]);
        }

        $question->delete();

        return response()->json(['message' => 'Question deleted successfully']);
    }
}
