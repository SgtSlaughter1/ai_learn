<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ClassMembership;
use App\Models\ClassModel;
use App\Models\ExamSimulation;
use App\Models\Feedback;
use App\Models\LearnerProgress;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\School;
use App\Models\SpacedRepetitionItem;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Models\UserGamification;
use App\Models\XpTransaction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Learner and admin actions that can be taken offline and are sent later:
 * each must be safe to resend and keep the time it actually happened.
 */
class OfflineActionsSyncTest extends TestCase
{
    use RefreshDatabase;

    protected User $learner;
    protected Topic $topic;

    protected function setUp(): void
    {
        parent::setUp();

        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $subject = Subject::factory()->create();
        $this->topic = Topic::factory()->create(['subject_id' => $subject->id]);
    }

    // ── Flashcards ──

    public function test_flashcard_session_resend_awards_xp_once(): void
    {
        $payload = ['ratings' => ['easy', 'good', 'again'], 'completed_at' => now()->toIso8601String()];
        $headers = ['Idempotency-Key' => 'flashcards-1'];

        $this->actingAs($this->learner)->postJson('/api/v1/flashcards/complete', $payload, $headers)
            ->assertOk()->assertJsonPath('xp_earned', 8); // 2 + 1 + 0 + 5 for finishing
        $this->actingAs($this->learner)->postJson('/api/v1/flashcards/complete', $payload, $headers)
            ->assertOk();

        $this->assertSame(1, XpTransaction::where('user_id', $this->learner->id)->where('source', 'flashcard_review')->count());
    }

    public function test_flashcard_ratings_are_validated(): void
    {
        $this->actingAs($this->learner)
            ->postJson('/api/v1/flashcards/complete', ['ratings' => ['easy', 'legendary']])
            ->assertStatus(422);

        $this->actingAs($this->learner)
            ->postJson('/api/v1/flashcards/complete', ['ratings' => array_fill(0, 101, 'easy')])
            ->assertStatus(422);
    }

    public function test_offline_flashcard_session_counts_for_the_day_it_happened(): void
    {
        UserGamification::create([
            'user_id' => $this->learner->id,
            'current_streak' => 2,
            'longest_streak' => 2,
            'last_active_date' => now()->subDays(2)->toDateString(),
        ]);

        $this->actingAs($this->learner)
            ->postJson('/api/v1/flashcards/complete', [
                'ratings' => ['good'],
                'completed_at' => now()->subDay()->setTime(9, 0)->toIso8601String(),
            ])
            ->assertOk();

        $profile = UserGamification::where('user_id', $this->learner->id)->first();
        $this->assertSame(3, $profile->current_streak);
        $this->assertSame(now()->subDay()->toDateString(), $profile->last_active_date->toDateString());
    }

    // ── Daily revision ──

    public function test_offline_review_is_scheduled_from_when_it_was_answered(): void
    {
        $question = Question::factory()->create(['topic_id' => $this->topic->id]);
        $correct = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        $item = SpacedRepetitionItem::create([
            'user_id' => $this->learner->id,
            'question_id' => $question->id,
            'topic_id' => $this->topic->id,
            'next_review_at' => now()->subDays(3),
        ]);

        $reviewedAt = now()->subDays(2)->startOfHour();
        $this->actingAs($this->learner)
            ->postJson('/api/v1/revision/submit', [
                'item_id' => $item->id,
                'selected_option_id' => $correct->id,
                'rating' => 'good',
                'reviewed_at' => $reviewedAt->toIso8601String(),
            ])
            ->assertOk();

        $item->refresh();
        $this->assertTrue($item->last_reviewed_at->equalTo($reviewedAt));
        $this->assertTrue($item->next_review_at->equalTo($reviewedAt->copy()->addDays(3)));
    }

    public function test_revision_cards_carry_no_plain_answers(): void
    {
        $question = Question::factory()->create(['topic_id' => $this->topic->id, 'explanation' => 'Because the answer is Photosynthesis.']);
        $correct = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => false]);
        $item = SpacedRepetitionItem::create(['user_id' => $this->learner->id, 'question_id' => $question->id, 'topic_id' => $this->topic->id, 'next_review_at' => now()]);

        $card = app(\App\Services\SpacedRepetition\SpacedRepetitionService::class)->formatQueueItem($item->fresh());

        $this->assertArrayNotHasKey('explanation', $card);
        foreach ($card['options'] as $option) {
            $this->assertArrayNotHasKey('is_correct', $option);
        }
        $this->assertSame(\App\Support\OfflineAnswerKey::hash('q', $question->id, $correct->id), $card['answer_hash']);
        $this->assertNotEmpty($card['explanation_sealed']);
        $this->assertStringNotContainsString('Photosynthesis', json_encode($card));
    }

    public function test_a_wrong_revision_answer_earns_nothing_whatever_the_rating(): void
    {
        $question = Question::factory()->create(['topic_id' => $this->topic->id]);
        QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        $wrong = QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => false]);
        $item = SpacedRepetitionItem::create(['user_id' => $this->learner->id, 'question_id' => $question->id, 'topic_id' => $this->topic->id, 'next_review_at' => now()]);

        $this->actingAs($this->learner)
            ->postJson('/api/v1/revision/submit', ['item_id' => $item->id, 'selected_option_id' => $wrong->id, 'rating' => 'easy'])
            ->assertOk()
            ->assertJson(['data' => ['is_correct' => false, 'xp_earned' => 0]]);
    }

    public function test_revision_session_counts_are_validated(): void
    {
        $this->actingAs($this->learner)
            ->postJson('/api/v1/revision/complete-session', ['completed_count' => 3, 'correct_count' => 9])
            ->assertStatus(422);
    }

    // ── Feedback ──

    public function test_guest_feedback_resent_with_same_client_id_is_stored_once(): void
    {
        $payload = ['message' => 'Offline mode is great', 'client_id' => (string) Str::uuid()];

        $this->postJson('/api/v1/feedback', $payload)->assertSuccessful();
        $this->postJson('/api/v1/feedback', $payload)->assertSuccessful();

        $this->assertSame(1, Feedback::where('client_id', $payload['client_id'])->count());
    }

    // ── Class enrolment ──

    public function test_repeated_enrolment_reuses_the_membership(): void
    {
        $admin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $school = School::create(['name' => 'Test School', 'slug' => 'test-school', 'category' => 'SECONDARY', 'is_active' => true]);
        $class = ClassModel::create(['school_id' => $school->id, 'name' => 'SS1 Gold', 'slug' => 'ss1-gold', 'grade_level' => 'SS1', 'is_active' => true]);

        foreach (range(1, 2) as $_) {
            $this->actingAs($admin)
                ->postJson("/api/v1/admin/classes/{$class->id}/enroll", ['email' => $this->learner->email])
                ->assertOk();
        }

        $this->assertSame(1, ClassMembership::where('class_id', $class->id)->where('user_id', $this->learner->id)->count());
    }

    // ── Exam simulations ──

    private function pastQuestion(): array
    {
        $id = DB::table('past_questions')->insertGetId([
            'exam_code' => 'waec',
            'topic_id' => $this->topic->id,
            'question_text' => 'What is 2 + 2?',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $correct = DB::table('past_question_options')->insertGetId([
            'past_question_id' => $id, 'option_text' => '4', 'is_correct' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('past_question_options')->insert([
            'past_question_id' => $id, 'option_text' => '5', 'is_correct' => false, 'created_at' => now(), 'updated_at' => now(),
        ]);
        return [$id, $correct];
    }

    public function test_simulation_started_offline_is_saved_and_counted_once(): void
    {
        [$questionId, $correctId] = $this->pastQuestion();
        $payload = [
            'client_id' => (string) Str::uuid(),
            'exam_code' => 'waec',
            'mode' => 'simulation',
            'duration_seconds' => 1800,
            'time_spent_seconds' => 300,
            'answers' => [$questionId => $correctId],
            'question_ids' => [$questionId],
            'completed_at' => now()->subHour()->toIso8601String(),
        ];

        // Sent twice with different idempotency keys (e.g. the device lost the first response
        // and a later app version resent it): the client id still prevents double counting.
        $this->actingAs($this->learner)->postJson('/api/v1/past-questions/simulation/submit', $payload)->assertOk();
        $this->actingAs($this->learner)->postJson('/api/v1/past-questions/simulation/submit', $payload)->assertOk();

        $simulation = ExamSimulation::where('client_id', $payload['client_id'])->first();
        $this->assertNotNull($simulation);
        $this->assertSame('completed', $simulation->status);
        $this->assertSame($this->learner->id, $simulation->user_id);

        $progress = LearnerProgress::where('user_id', $this->learner->id)->where('topic_id', $this->topic->id)->first();
        $this->assertSame(1, $progress->questions_attempted);
    }

    public function test_online_started_simulation_is_matched_by_client_id(): void
    {
        $clientId = (string) Str::uuid();
        $start = $this->actingAs($this->learner)
            ->postJson('/api/v1/past-questions/simulation/start', ['exam_code' => 'jamb', 'client_id' => $clientId])
            ->assertOk();
        $serverId = $start->json('data.simulation_id');

        [$questionId, $correctId] = $this->pastQuestion();
        $this->actingAs($this->learner)
            ->postJson('/api/v1/past-questions/simulation/submit', [
                'client_id' => $clientId,
                'exam_code' => 'jamb',
                'answers' => [$questionId => $correctId],
                'question_ids' => [$questionId],
            ])
            ->assertOk();

        $this->assertSame(1, ExamSimulation::where('client_id', $clientId)->count());
        $this->assertSame('completed', ExamSimulation::find($serverId)->status);
    }

    // ── Quiz marks ──

    public function test_quiz_data_includes_each_questions_marks(): void
    {
        $quiz = Quiz::factory()->create(['status' => 'active']);
        $question = Question::factory()->create(['topic_id' => $this->topic->id, 'status' => 'active']);
        QuestionOption::factory()->create(['question_id' => $question->id, 'is_correct' => true]);
        $quiz->questions()->attach($question->id, ['sort_order' => 1, 'marks' => 3]);

        $this->actingAs($this->learner)
            ->getJson("/api/v1/quizzes/{$quiz->id}")
            ->assertOk()
            ->assertJsonPath('quiz.questions.0.marks', 3);
    }
}
