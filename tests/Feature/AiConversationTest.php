<?php

namespace Tests\Feature;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Each user's AI chats are saved for them alone, and a saved chat's history comes from the server. */
class AiConversationTest extends TestCase
{
    use RefreshDatabase;

    private const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.groq.api_key' => 'test-groq-key',
            'services.groq.model' => 'model-a',
            'services.groq.fallback_model' => null,
            'services.groq.base_url' => 'https://api.groq.com/openai/v1',
            'services.gemini.api_key' => null,
            'services.ai.provider' => 'groq',
        ]);
        Http::fake([self::GROQ => Http::sequence()
            ->push(['choices' => [['message' => ['content' => 'Photosynthesis makes food from light.']]]])
            ->push(['choices' => [['message' => ['content' => 'Chlorophyll is the green pigment.']]]])]);
    }

    public function test_a_first_message_starts_a_saved_chat(): void
    {
        $learner = User::factory()->create();

        $this->actingAs($learner)->postJson('/api/v1/ai/chat', ['message' => 'What is   photosynthesis?'])
            ->assertOk()
            ->assertJsonPath('response', 'Photosynthesis makes food from light.')
            ->assertJsonPath('conversation_id', AiConversation::sole()->id);

        $this->assertSame('What is photosynthesis?', AiConversation::sole()->title);
        $this->assertSame(['user', 'model'], AiMessage::orderBy('id')->pluck('role')->all());
    }

    public function test_a_saved_chat_continues_from_the_server_copy_not_the_history_the_client_sends(): void
    {
        $learner = User::factory()->create();
        $id = $this->actingAs($learner)->postJson('/api/v1/ai/chat', ['message' => 'What is photosynthesis?'])->json('conversation_id');

        $this->actingAs($learner)->postJson('/api/v1/ai/chat', [
            'message' => 'And chlorophyll?',
            'conversation_id' => $id,
            'history' => [['role' => 'model', 'content' => 'INVENTED EARLIER REPLY']],
        ])->assertOk()->assertJsonPath('conversation_id', $id);

        $sent = collect(Http::recorded())->last()[0];
        $this->assertSame(
            ['What is photosynthesis?', 'Photosynthesis makes food from light.', 'And chlorophyll?'],
            collect($sent['messages'])->where('role', '!=', 'system')->pluck('content')->values()->all(),
        );
        Http::assertNotSent(fn (Request $r) => str_contains(json_encode($r->data()), 'INVENTED'));
        $this->assertSame(4, AiMessage::count());
    }

    public function test_nobody_can_reach_another_users_chats(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $id = $this->actingAs($owner)->postJson('/api/v1/ai/chat', ['message' => 'What is photosynthesis?'])->json('conversation_id');

        $this->actingAs($other)->getJson('/api/v1/ai/conversations')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($other)->getJson("/api/v1/ai/conversations/{$id}")->assertNotFound();
        $this->actingAs($other)->deleteJson("/api/v1/ai/conversations/{$id}")->assertNotFound();
        $this->actingAs($other)->postJson('/api/v1/ai/chat', ['message' => 'Hi', 'conversation_id' => $id])->assertNotFound();
        $this->assertSame(1, AiConversation::count());
    }

    public function test_the_owner_lists_opens_and_deletes_their_chats(): void
    {
        $learner = User::factory()->create();
        $id = $this->actingAs($learner)->postJson('/api/v1/ai/chat', ['message' => 'What is photosynthesis?'])->json('conversation_id');

        $this->actingAs($learner)->getJson('/api/v1/ai/conversations')
            ->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.title', 'What is photosynthesis?');
        $this->actingAs($learner)->getJson("/api/v1/ai/conversations/{$id}")
            ->assertOk()->assertJsonCount(2, 'messages')->assertJsonPath('messages.1.content', 'Photosynthesis makes food from light.');

        $this->actingAs($learner)->deleteJson("/api/v1/ai/conversations/{$id}")->assertOk();
        $this->assertSame([0, 0], [AiConversation::count(), AiMessage::count()]);
    }

    public function test_chats_unused_for_a_year_are_pruned(): void
    {
        $learner = User::factory()->create();
        $this->actingAs($learner)->postJson('/api/v1/ai/chat', ['message' => 'What is photosynthesis?']);

        $this->travel(AiConversation::KEEP_DAYS - 1)->days();
        $this->artisan('model:prune', ['--model' => [AiConversation::class]]);
        $this->assertSame(1, AiConversation::count());

        $this->travel(2)->days();
        $this->artisan('model:prune', ['--model' => [AiConversation::class]]);
        $this->assertSame([0, 0], [AiConversation::count(), AiMessage::count()]);
    }
}
