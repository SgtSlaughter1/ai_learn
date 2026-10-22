<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Question;
use App\Models\QuestionContext;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAnswer;
use App\Models\School;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** Shared passages: several questions about one comprehension passage, poem, diagram or table. */
class QuestionContextTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private School $school;
    private Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();
        [$this->admin, $this->school, $this->topic] = $this->schoolWithAdmin('own');
    }

    /** @return array{User, School, Topic} */
    private function schoolWithAdmin(string $slug): array
    {
        $admin = User::factory()->create(['role' => UserRole::SCHOOL_ADMIN]);
        $school = School::create(['name' => "School {$slug}", 'slug' => $slug, 'category' => 'senior', 'is_active' => true, 'admin_user_id' => $admin->id]);
        $subject = Subject::factory()->create(['school_id' => $school->id, 'name' => 'English Language']);
        $topic = Topic::factory()->create(['subject_id' => $subject->id, 'level' => 'SS2']);

        return [$admin, $school, $topic];
    }

    private function passage(string $clientId, array $overrides = []): array
    {
        return array_merge([
            'client_id' => $clientId,
            'type' => 'passage',
            'title' => 'The Market at Dawn',
            'instructions' => 'Read the passage and answer the questions that follow.',
            'body' => "Long before the sun rose over Oja-Oba, the traders were already at work.\nBuyers moved from stall to stall, __haggling__ patiently.",
            'show_line_numbers' => true,
        ], $overrides);
    }

    private function questionPayload(string $text, ?array $context = null, ?Topic $topic = null): array
    {
        return array_filter([
            'topic_id' => ($topic ?? $this->topic)->id,
            'question_text' => $text,
            'options' => [
                ['option_text' => 'Bargaining over the price', 'is_correct' => true],
                ['option_text' => 'Arguing angrily', 'is_correct' => false],
            ],
            'context' => $context,
        ]);
    }

    public function test_questions_saved_with_the_same_passage_share_it_in_order(): void
    {
        $clientId = (string) Str::uuid();

        $first = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage($clientId)))
            ->assertCreated()->json('question');
        $second = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q2', $this->passage($clientId)))
            ->assertCreated()->json('question');

        $this->assertSame(1, QuestionContext::count());
        $context = QuestionContext::first();
        $this->assertSame($this->school->id, $context->school_id);
        $this->assertSame([1, 2], [$first['context_order'], $second['context_order']]);
        $this->assertSame($context->id, $second['context']['id']);
        $this->assertSame(['Q1', 'Q2'], $context->questions->pluck('question_text')->all());
    }

    public function test_editing_the_passage_through_a_question_changes_it_for_all(): void
    {
        $clientId = (string) Str::uuid();
        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage($clientId)))->assertCreated();
        $id = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q2', $this->passage($clientId)))->json('question.id');

        $this->actingAs($this->admin)->patchJson("/api/v1/admin/questions/{$id}", $this->questionPayload('Q2', $this->passage($clientId, ['title' => 'Fixed typo'])))
            ->assertOk();

        $this->assertSame('Fixed typo', QuestionContext::first()->title);
        $this->assertSame(2, (int) Question::find($id)->context_order); // unchanged: still question 2
    }

    public function test_a_passage_needs_text_or_a_picture(): void
    {
        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage((string) Str::uuid(), ['body' => ''])))
            ->assertUnprocessable()->assertJsonValidationErrors('context.body');

        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage((string) Str::uuid(), ['type' => 'diagram', 'body' => '', 'image_url' => '/storage/questions/map.png'])))
            ->assertCreated();
    }

    public function test_another_school_cannot_add_to_or_edit_this_school_passage(): void
    {
        $clientId = (string) Str::uuid();
        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage($clientId)))->assertCreated();
        [$otherAdmin, , $otherTopic] = $this->schoolWithAdmin('other');

        $this->actingAs($otherAdmin)->postJson('/api/v1/admin/questions', $this->questionPayload('Hijack', $this->passage($clientId, ['title' => 'Hijacked']), $otherTopic))
            ->assertForbidden();
        $context = QuestionContext::first();
        $this->actingAs($otherAdmin)->patchJson("/api/v1/admin/question-contexts/{$context->id}", ['title' => 'Hijacked'])->assertForbidden();
        $this->actingAs($otherAdmin)->deleteJson("/api/v1/admin/question-contexts/{$context->id}")->assertForbidden();
        $this->actingAs($otherAdmin)->getJson("/api/v1/admin/question-contexts?topic_id={$this->topic->id}")->assertForbidden();

        $this->assertSame('The Market at Dawn', $context->fresh()->title);
        $this->assertSame(1, Question::count());
    }

    public function test_a_passage_stays_in_its_topic(): void
    {
        $clientId = (string) Str::uuid();
        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage($clientId)))->assertCreated();
        $otherTopic = Topic::factory()->create(['subject_id' => $this->topic->subject_id, 'level' => 'SS2']);

        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q2', $this->passage($clientId), $otherTopic))
            ->assertUnprocessable()->assertJsonValidationErrors('context');
    }

    public function test_linking_lists_the_topic_passages_and_detach_takes_a_question_off(): void
    {
        $clientId = (string) Str::uuid();
        $id = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Q1', $this->passage($clientId)))->json('question.id');

        $this->actingAs($this->admin)->getJson("/api/v1/admin/question-contexts?topic_id={$this->topic->id}")
            ->assertOk()->assertJsonPath('contexts.0.client_id', $clientId)->assertJsonPath('contexts.0.questions_count', 1);

        $this->actingAs($this->admin)->patchJson("/api/v1/admin/questions/{$id}", $this->questionPayload('Q1') + ['detach_context' => true])->assertOk();
        $this->assertNull(Question::find($id)->context_id);
    }

    public function test_reordering_only_accepts_the_passage_own_questions(): void
    {
        $clientId = (string) Str::uuid();
        $ids = collect(['Q1', 'Q2', 'Q3'])->map(fn ($t) => $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/questions', $this->questionPayload($t, $this->passage($clientId)))->json('question.id'))->all();
        $context = QuestionContext::first();
        $stranger = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Single'))->json('question.id');

        $this->actingAs($this->admin)->patchJson("/api/v1/admin/question-contexts/{$context->id}/order", ['question_ids' => [$ids[2], $stranger]])
            ->assertUnprocessable();
        $this->actingAs($this->admin)->patchJson("/api/v1/admin/question-contexts/{$context->id}/order", ['question_ids' => [$ids[2], $ids[0], $ids[1]]])
            ->assertOk();

        $this->assertSame(['Q3', 'Q1', 'Q2'], $context->questions()->pluck('question_text')->all());
    }

    public function test_deleting_a_passage_keeps_or_removes_its_questions(): void
    {
        $keep = (string) Str::uuid();
        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Kept', $this->passage($keep)))->assertCreated();
        $this->actingAs($this->admin)->deleteJson('/api/v1/admin/question-contexts/'.QuestionContext::first()->id)->assertOk();
        $this->assertSame(0, QuestionContext::count());
        $this->assertNull(Question::where('question_text', 'Kept')->first()->context_id);

        $remove = (string) Str::uuid();
        $answeredId = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Answered', $this->passage($remove)))->json('question.id');
        $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $this->questionPayload('Unanswered', $this->passage($remove)))->assertCreated();
        $answered = Question::find($answeredId);
        $attempt = \App\Models\QuizAttempt::create([
            'id' => (string) Str::uuid(), 'user_id' => User::factory()->create(['role' => UserRole::LEARNER])->id,
            'quiz_id' => Quiz::factory()->create()->id, 'status' => 'completed', 'started_at' => now(),
        ]);
        QuizAnswer::create([
            'id' => (string) Str::uuid(), 'quiz_attempt_id' => $attempt->id,
            'question_id' => $answered->id, 'selected_option_id' => $answered->options->first()->id,
        ]);

        $this->actingAs($this->admin)->deleteJson('/api/v1/admin/question-contexts/'.QuestionContext::first()->id.'?delete_questions=1')->assertOk();
        $this->assertSame('archived', $answered->fresh()->status); // learners' history is kept
        $this->assertNull(Question::where('question_text', 'Unanswered')->first());
    }

    /** A quiz with one 5-question passage and $singles single questions. */
    private function quizWithPassage(int $singles): array
    {
        $quiz = Quiz::factory()->create(['status' => 'active']);
        $context = QuestionContext::create(['client_id' => (string) Str::uuid(), 'topic_id' => $this->topic->id, 'school_id' => null, 'title' => 'Passage', 'body' => 'Text']);
        $sort = 0;
        $passageIds = [];
        // Stored out of order: context_order decides.
        foreach ([3, 1, 5, 2, 4] as $order) {
            $q = Question::factory()->create(['topic_id' => $this->topic->id, 'status' => 'active', 'context_id' => $context->id, 'context_order' => $order]);
            QuestionOption::factory()->create(['question_id' => $q->id, 'is_correct' => true]);
            $quiz->questions()->attach($q->id, ['sort_order' => ++$sort, 'marks' => 1]);
            $passageIds[$order] = $q->id;
        }
        for ($i = 0; $i < $singles; $i++) {
            $q = Question::factory()->create(['topic_id' => $this->topic->id, 'status' => 'active']);
            QuestionOption::factory()->create(['question_id' => $q->id, 'is_correct' => true]);
            $quiz->questions()->attach($q->id, ['sort_order' => ++$sort, 'marks' => 1]);
        }
        ksort($passageIds);

        return [$quiz, $context, array_values($passageIds)];
    }

    public function test_an_attempt_takes_a_passage_whole_and_in_order(): void
    {
        [$quiz, $context, $passageIds] = $this->quizWithPassage(12);
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $sawPassage = false;

        for ($i = 0; $i < 25; $i++) {
            $data = $this->actingAs($learner)->getJson("/api/v1/quizzes/{$quiz->id}")->assertOk()->json('quiz');
            $ids = array_column($data['questions'], 'id');
            $this->assertGreaterThanOrEqual(10, count($ids));
            $start = array_search($passageIds[0], $ids, true);
            if ($start === false) {
                $this->assertEmpty(array_intersect($passageIds, $ids));
                $this->assertSame([], $data['contexts']);
            } else {
                $sawPassage = true;
                $this->assertSame($passageIds, array_slice($ids, $start, 5));
                $this->assertSame($context->id, $data['contexts'][0]['id']);
                $this->assertSame('Text', $data['contexts'][0]['body']);
            }
        }
        $this->assertTrue($sawPassage, 'The passage should come up in 25 tries.');
    }

    public function test_grading_pads_missing_questions_a_whole_passage_at_a_time(): void
    {
        [$quiz, , $passageIds] = $this->quizWithPassage(3);
        $quiz->load(['questions' => fn ($q) => $q->where('status', 'active'), 'questions.options']);
        $singles = $quiz->questions->whereNull('context_id')->pluck('id')->all();

        // 3 singles answered; 8 questions exist, so all 8 are graded, the passage in one piece.
        $graded = $quiz->questionsForAttempt($singles)->pluck('id')->all();
        $this->assertCount(8, $graded);
        $this->assertSame($passageIds, array_values(array_intersect($graded, $passageIds)));
    }

    public function test_the_result_review_keeps_a_passage_together_in_order(): void
    {
        [$quiz, $context, $passageIds] = $this->quizWithPassage(1);
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $single = $quiz->questions()->whereNull('context_id')->value('questions.id');
        $attempt = \App\Models\QuizAttempt::create(['id' => (string) Str::uuid(), 'user_id' => $learner->id, 'quiz_id' => $quiz->id, 'status' => 'completed', 'started_at' => now()]);
        // Saved in a scrambled order, as an offline sync may save them.
        foreach ([$passageIds[3], $single, $passageIds[0], $passageIds[4], $passageIds[2], $passageIds[1]] as $questionId) {
            QuizAnswer::create(['id' => (string) Str::uuid(), 'quiz_attempt_id' => $attempt->id, 'question_id' => $questionId]);
        }

        $ids = array_column($this->actingAs($learner)->getJson("/api/v1/quizzes/attempts/{$attempt->id}")->assertOk()->json('attempt.answers'), 'question_id');

        $this->assertSame(array_merge($passageIds, [$single]), $ids);
    }

    public function test_flashcards_leave_out_passage_questions(): void
    {
        $this->quizWithPassage(2);
        $learner = User::factory()->create(['role' => UserRole::LEARNER]);

        $deck = $this->actingAs($learner)->getJson('/api/v1/flashcards/deck')->assertOk()->json('deck');
        $ids = array_column($deck, 'id');
        $this->assertNotEmpty($ids);
        $this->assertSame(0, Question::whereIn('id', $ids)->whereNotNull('context_id')->count());
    }
}
