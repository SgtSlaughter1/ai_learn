<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Jobs\AwardQuizCompletionXp;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Subject;
use App\Models\Topic;
use App\Models\User;
use App\Models\XpTransaction;
use App\Services\Gamification\GamificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class BatchSyncTest extends TestCase
{
    use RefreshDatabase;

    protected User $learner;

    protected Quiz $quiz;

    protected Question $question;

    protected QuestionOption $correct;

    protected function setUp(): void
    {
        parent::setUp();
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $topic = Topic::factory()->create(['subject_id' => Subject::factory()->create()->id]);
        $this->question = Question::factory()->create(['topic_id' => $topic->id, 'status' => 'active']);
        $this->correct = QuestionOption::factory()->create(['question_id' => $this->question->id, 'is_correct' => true]);
        $this->quiz = Quiz::factory()->create(['status' => 'active']);
        $this->quiz->questions()->attach($this->question->id, ['sort_order' => 1, 'marks' => 1]);
    }

    private function attemptItem(string $id): array
    {
        return [
            'key' => "attempt-{$id}",
            'method' => 'POST',
            'path' => "/api/v1/quizzes/attempts/{$id}/sync",
            'body' => [
                'quiz_id' => $this->quiz->id,
                'answers' => [['question_id' => $this->question->id, 'selected_option_id' => $this->correct->id]],
                'duration_seconds' => 60,
            ],
        ];
    }

    private function flashcardItem(string $key): array
    {
        return ['key' => $key, 'method' => 'POST', 'path' => '/api/v1/flashcards/complete', 'body' => ['ratings' => ['easy', 'good']]];
    }

    public function test_batch_applies_each_item_in_order(): void
    {
        $ids = [(string) Str::uuid(), (string) Str::uuid()];

        $response = $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', ['items' => [
            $this->attemptItem($ids[0]),
            $this->flashcardItem('flash-1'),
            $this->attemptItem($ids[1]),
        ]])->assertOk();

        $this->assertSame([200, 200, 200], array_column($response->json('results'), 'status'));
        $this->assertSame(2, QuizAttempt::whereIn('id', $ids)->count());
        $this->assertSame(1, XpTransaction::where('user_id', $this->learner->id)->where('source', 'flashcard_review')->count());
    }

    public function test_replayed_batch_writes_nothing_new(): void
    {
        $items = ['items' => [$this->attemptItem((string) Str::uuid()), $this->flashcardItem('flash-replay')]];

        $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', $items)->assertOk();
        $replay = $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', $items)->assertOk();

        $this->assertSame([200, 200], array_column($replay->json('results'), 'status'));
        $this->assertSame(1, QuizAttempt::count());
        $this->assertSame(1, XpTransaction::where('user_id', $this->learner->id)->where('source', 'flashcard_review')->count());
    }

    public function test_items_are_still_authorized_individually(): void
    {
        $response = $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', ['items' => [
            ['key' => 'not-mine', 'method' => 'DELETE', 'path' => '/api/v1/admin/learners/'.$this->learner->id],
            $this->flashcardItem('flash-after-denied'),
        ]])->assertOk();

        // A permanent refusal doesn't stop the batch; later independent changes still apply.
        $this->assertSame([403, 200], array_column($response->json('results'), 'status'));
    }

    public function test_edits_sync_as_patch_and_legacy_put_still_applies(): void
    {
        $admin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $subject = Subject::factory()->create();
        $path = "/api/v1/admin/subjects/{$subject->id}";

        $response = $this->actingAs($admin)->postJson('/api/v1/sync/batch', ['items' => [
            ['key' => 'edit-patch', 'method' => 'PATCH', 'path' => $path, 'body' => ['name' => 'Patched']],
            // Queued on a device before edits switched to PATCH.
            ['key' => 'edit-put', 'method' => 'PUT', 'path' => $path, 'body' => ['name' => 'Put later']],
        ]])->assertOk();

        $this->assertSame([200, 200], array_column($response->json('results'), 'status'));
        $this->assertSame('Put later', $subject->fresh()->name);
    }

    public function test_patch_edits_are_still_validated_and_authorized(): void
    {
        $admin = User::factory()->create(['role' => UserRole::PLATFORM_ADMIN]);
        $subject = Subject::factory()->create();

        $this->actingAs($admin)->patchJson("/api/v1/admin/subjects/{$subject->id}", ['name' => ''])->assertUnprocessable();
        $this->actingAs($this->learner)->patchJson("/api/v1/admin/subjects/{$subject->id}", ['name' => 'Hijacked'])->assertForbidden();
        $this->assertNotSame('Hijacked', $subject->fresh()->name);
    }

    public function test_only_sync_endpoints_can_be_batched(): void
    {
        $response = $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', ['items' => [
            ['key' => 'ai', 'method' => 'POST', 'path' => '/api/v1/ai/chat', 'body' => ['message' => 'hi']],
            ['key' => 'nested', 'method' => 'POST', 'path' => '/api/v1/sync/batch', 'body' => []],
        ]])->assertOk();

        $this->assertSame(['not_batchable', 'not_batchable'], array_column(array_column($response->json('results'), 'body'), 'code'));
    }

    public function test_batch_stops_at_a_change_that_must_be_retried(): void
    {
        // A key that is mid-flight elsewhere answers 409 request_in_progress: retry later.
        \DB::table('idempotency_keys')->insert([
            'user_id' => $this->learner->id, 'idempotency_key' => 'busy',
            'request_hash' => hash('sha256', 'POST|api/v1/flashcards/complete|'.json_encode(['ratings' => ['easy', 'good']])),
            'status' => 'processing', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $busy = $this->flashcardItem('busy');

        $response = $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', ['items' => [
            $busy,
            $this->flashcardItem('after-busy'),
        ]])->assertOk();

        $results = $response->json('results');
        $this->assertSame(409, $results[0]['status']);
        $this->assertTrue($results[1]['skipped']);
        $this->assertSame(0, XpTransaction::where('source', 'flashcard_review')->count());
    }

    public function test_batch_requires_sign_in(): void
    {
        $this->postJson('/api/v1/sync/batch', ['items' => [$this->flashcardItem('x')]])->assertUnauthorized();
    }

    public function test_quiz_xp_job_awards_once_however_often_it_runs(): void
    {
        $id = (string) Str::uuid();
        $this->actingAs($this->learner)->postJson('/api/v1/sync/batch', ['items' => [$this->attemptItem($id)]])->assertOk();
        $xpAfterSync = XpTransaction::where('user_id', $this->learner->id)->sum('amount');

        // A retried or duplicated job must not award again.
        (new AwardQuizCompletionXp($id))->handle(app(GamificationService::class));
        (new AwardQuizCompletionXp($id))->handle(app(GamificationService::class));

        $this->assertNotNull(QuizAttempt::find($id)->xp_awarded_at);
        $this->assertGreaterThan(0, $xpAfterSync);
        $this->assertEquals($xpAfterSync, XpTransaction::where('user_id', $this->learner->id)->sum('amount'));
    }

    public function test_session_check_reports_guests_without_an_error(): void
    {
        // Public pages run the sync engine too: a guest gets a normal answer, not a 401.
        $this->getJson('/api/v1/sync/session')->assertOk()->assertJsonPath('user_id', null);

        $this->actingAs($this->learner)->getJson('/api/v1/sync/session')
            ->assertOk()->assertJsonPath('user_id', $this->learner->id);
    }
}
