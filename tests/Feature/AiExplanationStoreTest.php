<?php

namespace Tests\Feature;

use App\Models\AiExplanation;
use App\Models\AiUsageDaily;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\User;
use App\Services\AIService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * AI explanations are written once and reused: cache, then the saved table, then the AI.
 * Every billed AI reply is counted per day, feature and model.
 */
class AiExplanationStoreTest extends TestCase
{
    use RefreshDatabase;

    private const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.groq.api_key' => 'test-groq-key',
            'services.groq.model' => 'openai/gpt-oss-120b',
            'services.groq.fallback_model' => null,
            'services.groq.base_url' => 'https://api.groq.com/openai/v1',
            'services.gemini.api_key' => null,
            'services.ai.provider' => null,
        ]);
    }

    private static function groqReply(string $content, int $in = 300, int $out = 120): array
    {
        return [
            'choices' => [['message' => ['role' => 'assistant', 'content' => $content], 'finish_reason' => 'stop']],
            'usage' => ['prompt_tokens' => $in, 'completion_tokens' => $out, 'total_tokens' => $in + $out],
        ];
    }

    /** @return array{0: Question, 1: QuestionOption} the question and its wrong option */
    private function question(): array
    {
        $question = Question::factory()->create();
        QuestionOption::create(['question_id' => $question->id, 'option_text' => '4', 'is_correct' => true, 'sort_order' => 0]);
        $wrong = QuestionOption::create(['question_id' => $question->id, 'option_text' => '5', 'is_correct' => false, 'sort_order' => 1]);

        return [$question, $wrong];
    }

    public function test_the_first_explanation_is_saved_and_reused_after_the_cache_is_cleared(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('Because 2 + 2 is 4.'))]);
        [$question, $wrong] = $this->question();

        $this->assertSame('Because 2 + 2 is 4.', app(AIService::class)->explainAnswer($question, $wrong->id));

        $saved = AiExplanation::sole();
        $this->assertSame([AiExplanation::SOURCE_QUESTION, $question->id, $wrong->id, 'groq', 'openai/gpt-oss-120b', 300, 120], [
            $saved->source, $saved->source_id, $saved->option_id, $saved->provider, $saved->model, $saved->prompt_tokens, $saved->completion_tokens,
        ]);

        // A cleared cache (a deploy, or the maintenance route) no longer means paying again.
        Cache::flush();
        $this->assertSame('Because 2 + 2 is 4.', app(AIService::class)->explainAnswer($question->fresh(), $wrong->id));
        Http::assertSentCount(1);
    }

    public function test_an_edited_question_gets_a_fresh_explanation(): void
    {
        Http::fake([self::GROQ => Http::sequence()->push(self::groqReply('First version.'))->push(self::groqReply('After the edit.'))]);
        [$question, $wrong] = $this->question();
        app(AIService::class)->explainAnswer($question, $wrong->id);

        $this->travel(5)->minutes();
        $question->update(['question_text' => 'What is 2 + 2, exactly?']);

        $this->assertSame('After the edit.', app(AIService::class)->explainAnswer($question->fresh(), $wrong->id));
        $this->assertSame(2, AiExplanation::count());
    }

    public function test_the_offline_answer_is_never_saved(): void
    {
        Http::fake(['*' => Http::response('down', 500)]);
        [$question, $wrong] = $this->question();

        $this->assertNotSame('', app(AIService::class)->explainAnswer($question, $wrong->id));
        $this->assertSame(0, AiExplanation::count());
        $this->assertSame(0, AiUsageDaily::count());
    }

    public function test_tokens_are_counted_per_feature_and_model(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('Keep practising!', 900, 200))]);
        $learner = User::factory()->create();

        app(AIService::class)->generateChatResponse($learner, 'Help me revise.', []);
        app(AIService::class)->generateChatResponse($learner, 'And algebra?', []);

        $row = AiUsageDaily::sole();
        $this->assertSame(['learner_chat', 'groq', 'openai/gpt-oss-120b', 2, 1800, 400], [
            $row->feature, $row->provider, $row->model, $row->requests, $row->prompt_tokens, $row->completion_tokens,
        ]);
    }

    public function test_a_reply_cut_off_at_the_token_limit_is_still_counted(): void
    {
        // Billed but empty: no answer for the learner, but the tokens were paid for.
        Http::fake([self::GROQ => Http::response(['choices' => [['message' => ['content' => ''], 'finish_reason' => 'length']], 'usage' => ['prompt_tokens' => 400, 'completion_tokens' => 1500]])]);
        [$question, $wrong] = $this->question();

        app(AIService::class)->explainAnswer($question, $wrong->id);

        $this->assertSame([1, 1500], [AiUsageDaily::sole()->requests, AiUsageDaily::sole()->completion_tokens]);
        $this->assertSame(0, AiExplanation::count());
    }

    public function test_the_usage_command_lists_each_feature(): void
    {
        AiUsageDaily::record('explain_question', 'groq', 'openai/gpt-oss-120b', 300, 120);
        AiUsageDaily::record('learner_chat', 'gemini', 'gemini-3.1-flash-lite', 900, 200);

        $this->artisan('ai:usage', ['--days' => 7])
            ->expectsOutputToContain('Explanations saved for reuse: 0 school questions, 0 past questions.')
            ->assertSuccessful();
        $this->assertSame(2, AiUsageDaily::count());
    }
}
