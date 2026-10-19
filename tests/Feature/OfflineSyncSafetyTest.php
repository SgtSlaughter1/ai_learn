<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAnswer;
use App\Models\QuizAttempt;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Models\UserGamification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Guarantees the offline sync engine relies on: retries never duplicate data,
 * stale offline payloads never cause database errors, and nothing is lost.
 */
class OfflineSyncSafetyTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $learner;
    protected Topic $topic;
    protected Quiz $quiz;
    protected Question $question;
    protected QuestionOption $correct;
    protected QuestionOption $wrong;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);

        $subject = Subject::factory()->create();
        $this->topic = Topic::factory()->create(['subject_id' => $subject->id]);

        $this->question = Question::factory()->create([
            'topic_id' => $this->topic->id,
            'status' => 'active',
        ]);
        $this->correct = QuestionOption::factory()->create([
            'question_id' => $this->question->id, 'option_text' => 'Lagos', 'is_correct' => true, 'sort_order' => 0,
        ]);
        $this->wrong = QuestionOption::factory()->create([
            'question_id' => $this->question->id, 'option_text' => 'Kano', 'is_correct' => false, 'sort_order' => 1,
        ]);

        $this->quiz = Quiz::factory()->create(['status' => 'active']);
        $this->quiz->questions()->attach($this->question->id, ['sort_order' => 1, 'marks' => 1]);
    }

    private function attemptPayload(?int $optionId, array $extra = []): array
    {
        return array_merge([
            'quiz_id' => $this->quiz->id,
            'answers' => [['question_id' => $this->question->id, 'selected_option_id' => $optionId]],
            'duration_seconds' => 60,
        ], $extra);
    }

    // ── Idempotency-Key middleware ──

    public function test_retried_create_with_same_idempotency_key_does_not_duplicate(): void
    {
        $payload = [
            'topic_id' => $this->topic->id,
            'question_text' => 'What is the capital of Oyo State?',
            'options' => [
                ['option_text' => 'Ibadan', 'is_correct' => true],
                ['option_text' => 'Ilorin', 'is_correct' => false],
            ],
        ];
        $headers = ['Idempotency-Key' => 'test-key-1'];

        $first = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $payload, $headers);
        $second = $this->actingAs($this->admin)->postJson('/api/v1/admin/questions', $payload, $headers);

        $first->assertSuccessful();
        $second->assertSuccessful()->assertHeader('Idempotent-Replayed', 'true');
        $this->assertSame($first->json(), $second->json());
        $this->assertSame(1, Question::where('question_text', 'What is the capital of Oyo State?')->count());
    }

    public function test_idempotency_key_reused_for_different_payload_is_rejected(): void
    {
        $headers = ['Idempotency-Key' => 'test-key-2'];
        $base = [
            'topic_id' => $this->topic->id,
            'options' => [['option_text' => 'A', 'is_correct' => true], ['option_text' => 'B', 'is_correct' => false]],
        ];

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/questions', $base + ['question_text' => 'First'], $headers)
            ->assertSuccessful();

        $this->actingAs($this->admin)
            ->postJson('/api/v1/admin/questions', $base + ['question_text' => 'Second'], $headers)
            ->assertStatus(422)
            ->assertJsonPath('code', 'idempotency_key_reused');
    }

    // ── Quiz attempt sync ──

    public function test_attempt_sync_is_idempotent(): void
    {
        $id = (string) Str::uuid();

        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload($this->correct->id))
            ->assertOk()->assertJsonPath('score', 1);

        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload($this->correct->id))
            ->assertOk()->assertJsonPath('already_synced', true);

        $this->assertSame(1, QuizAttempt::count());
        $this->assertSame(1, QuizAnswer::count());
    }

    public function test_attempt_sync_rejects_another_users_attempt_id(): void
    {
        $id = (string) Str::uuid();
        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload($this->correct->id))
            ->assertOk();

        $other = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->actingAs($other)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload($this->correct->id))
            ->assertStatus(409)
            ->assertJsonPath('code', 'attempt_owner_mismatch');
    }

    public function test_attempt_with_stale_option_id_syncs_without_foreign_key_error(): void
    {
        $id = (string) Str::uuid();

        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload(999999))
            ->assertOk()
            ->assertJsonPath('score', 0);

        $this->assertDatabaseHas('quiz_answers', ['quiz_attempt_id' => $id, 'selected_option_id' => null]);
    }

    public function test_attempt_for_removed_questions_reports_conflict_instead_of_scoring_zero(): void
    {
        $id = (string) Str::uuid();
        $payload = $this->attemptPayload(null);
        $payload['answers'] = [['question_id' => 999999, 'selected_option_id' => 1]];

        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $payload)
            ->assertStatus(409)
            ->assertJsonPath('code', 'quiz_content_changed');

        $this->assertSame(0, QuizAttempt::count());
    }

    public function test_attempt_keeps_offline_completion_time_and_does_not_break_streak(): void
    {
        UserGamification::create([
            'user_id' => $this->learner->id,
            'total_xp' => 100,
            'current_streak' => 3,
            'longest_streak' => 3,
            'last_active_date' => now()->subDays(2)->toDateString(),
        ]);

        // Taken offline yesterday, synced today.
        $completedAt = now()->subDay()->setTime(10, 0);
        $id = (string) Str::uuid();

        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload($this->correct->id, [
                'completed_at' => $completedAt->toIso8601String(),
            ]))
            ->assertOk();

        $attempt = QuizAttempt::find($id);
        $this->assertTrue($attempt->completed_at->isSameDay($completedAt));

        $profile = UserGamification::where('user_id', $this->learner->id)->first();
        $this->assertSame(4, $profile->current_streak);
        $this->assertGreaterThan(100, $profile->total_xp);
        $this->assertDatabaseMissing('xp_transactions', ['user_id' => $this->learner->id, 'source' => 'streak_penalty']);
    }

    public function test_same_day_activity_does_not_apply_streak_penalty(): void
    {
        UserGamification::create([
            'user_id' => $this->learner->id,
            'total_xp' => 100,
            'current_streak' => 5,
            'longest_streak' => 5,
            'last_active_date' => now()->toDateString(),
        ]);

        $this->actingAs($this->learner)
            ->postJson('/api/v1/quizzes/attempts/' . Str::uuid() . '/sync', $this->attemptPayload($this->correct->id))
            ->assertOk();

        $profile = UserGamification::where('user_id', $this->learner->id)->first();
        $this->assertSame(5, $profile->current_streak);
        $this->assertDatabaseMissing('xp_transactions', ['user_id' => $this->learner->id, 'source' => 'streak_penalty']);
    }

    public function test_gamification_sync_no_longer_accepts_client_xp(): void
    {
        $this->actingAs($this->learner)
            ->postJson('/api/v1/gamification/sync', [
                'total_xp' => 999999, 'level' => 50, 'current_streak' => 100, 'longest_streak' => 100,
            ])
            ->assertOk();

        $this->assertLessThan(999999, UserGamification::where('user_id', $this->learner->id)->value('total_xp'));
    }

    // ── Archiving instead of deleting ──

    public function test_answered_question_is_archived_instead_of_failing(): void
    {
        $this->actingAs($this->learner)
            ->postJson('/api/v1/quizzes/attempts/' . Str::uuid() . '/sync', $this->attemptPayload($this->correct->id))
            ->assertOk();

        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/admin/questions/{$this->question->id}")
            ->assertOk()
            ->assertJsonPath('archived', true);

        $this->assertDatabaseHas('questions', ['id' => $this->question->id, 'status' => 'archived']);
        $this->assertSame(0, $this->quiz->questions()->count());

        $listed = collect($this->actingAs($this->admin)->getJson('/api/v1/admin/questions')->json('data'));
        $this->assertFalse($listed->contains('id', $this->question->id));
    }

    public function test_unanswered_question_is_deleted(): void
    {
        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/admin/questions/{$this->question->id}")
            ->assertOk();

        $this->assertDatabaseMissing('questions', ['id' => $this->question->id]);
    }

    public function test_editing_answered_question_keeps_option_ids_and_history(): void
    {
        $id = (string) Str::uuid();
        $this->actingAs($this->learner)
            ->postJson("/api/v1/quizzes/attempts/{$id}/sync", $this->attemptPayload($this->wrong->id))
            ->assertOk();

        $this->actingAs($this->admin)
            ->putJson("/api/v1/admin/questions/{$this->question->id}", [
                'topic_id' => $this->topic->id,
                'question_text' => 'Which city was the former capital of Nigeria?',
                'options' => [
                    ['id' => $this->correct->id, 'option_text' => 'Lagos', 'is_correct' => true],
                    ['option_text' => 'Abuja', 'is_correct' => false],
                ],
            ])
            ->assertOk();

        // "Lagos" kept its id; "Kano" was removed and the old answer survives with its link cleared.
        $this->assertDatabaseHas('question_options', ['id' => $this->correct->id, 'option_text' => 'Lagos']);
        $this->assertDatabaseMissing('question_options', ['id' => $this->wrong->id]);
        $this->assertDatabaseHas('quiz_answers', ['quiz_attempt_id' => $id, 'selected_option_id' => null, 'is_correct' => false]);
    }

    public function test_learner_with_quiz_history_is_archived_and_cannot_sign_in(): void
    {
        $this->learner->update(['password' => 'secret-password']);
        $email = $this->learner->email;

        $this->actingAs($this->learner)
            ->postJson('/api/v1/quizzes/attempts/' . Str::uuid() . '/sync', $this->attemptPayload($this->correct->id))
            ->assertOk();

        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/admin/learners/{$this->learner->id}")
            ->assertOk()
            ->assertJsonPath('archived', true);

        $this->assertSoftDeleted('users', ['id' => $this->learner->id, 'archived_email' => $email]);
        $this->assertSame(1, QuizAttempt::where('user_id', $this->learner->id)->count());

        auth()->logout();
        $this->postJson('/login', ['email' => $email, 'password' => 'secret-password'])->assertUnauthorized();
        $this->assertGuest();

        // The email is free again for a new account.
        $this->assertSame(0, User::withTrashed()->where('email', $email)->count());
    }

    public function test_learner_without_history_is_archived_too(): void
    {
        // Deletes are always soft: nothing is erased, even without quiz history.
        $this->actingAs($this->admin)
            ->deleteJson("/api/v1/admin/learners/{$this->learner->id}")
            ->assertOk()
            ->assertJsonPath('archived', true);

        $this->assertSame(1, User::withTrashed()->whereKey($this->learner->id)->count());
        $this->assertSame(0, User::whereKey($this->learner->id)->count());
    }

    public function test_recreating_a_deleted_subject_does_not_hit_slug_unique_index(): void
    {
        $payload = ['name' => 'Further Mathematics'];

        $first = $this->actingAs($this->admin)->postJson('/api/v1/admin/subjects', $payload)->assertSuccessful();
        $subjectId = $first->json('subject.id') ?? $first->json('data.id');

        $this->actingAs($this->admin)->deleteJson("/api/v1/admin/subjects/{$subjectId}")->assertOk();

        $this->actingAs($this->admin)->postJson('/api/v1/admin/subjects', $payload)->assertSuccessful();
        $this->assertSame(2, Subject::withTrashed()->where('name', 'Further Mathematics')->count());
    }
}
