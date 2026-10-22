<?php

namespace Tests\Feature;

use App\Services\AIService;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Which AI provider answers, and what happens when one fails (no real API calls). */
class AIProviderTest extends TestCase
{
    private const GROQ = 'https://api.groq.com/openai/v1/chat/completions';

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.groq.api_key' => 'test-groq-key',
            'services.groq.model' => 'openai/gpt-oss-120b',
            'services.groq.fallback_model' => 'openai/gpt-oss-20b',
            'services.groq.base_url' => 'https://api.groq.com/openai/v1',
            'services.gemini.api_key' => 'test-gemini-key',
            'services.ai.provider' => null,
        ]);
    }

    /** Exposes the protected generate() for these tests. */
    private function ai(?string $provider = null): AIService
    {
        return new class($provider) extends AIService
        {
            public function ask(string $prompt, bool $json = false): ?string
            {
                return $this->generate([['role' => 'user', 'parts' => [['text' => $prompt]]]], 'Be brief.', $json);
            }
        };
    }

    private static function groqReply(string $content): array
    {
        return ['choices' => [['message' => ['role' => 'assistant', 'content' => $content]]]];
    }

    private static function geminiReply(string $text): array
    {
        return ['candidates' => [['content' => ['parts' => [['text' => $text]]]]]];
    }

    public function test_groq_answers_first_when_its_key_is_set(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply('From Groq'))]);

        $this->assertSame('From Groq', $this->ai()->ask('Hi'));

        Http::assertSent(fn (Request $r) => $r->url() === self::GROQ
            && $r->hasHeader('Authorization', 'Bearer test-groq-key')
            && $r['model'] === 'openai/gpt-oss-120b'
            && $r['reasoning_format'] === 'hidden'
            && $r['messages'][0] === ['role' => 'system', 'content' => 'Be brief.']
            && $r['messages'][1] === ['role' => 'user', 'content' => 'Hi']);
        Http::assertNotSent(fn (Request $r) => str_contains($r->url(), 'generativelanguage'));
    }

    public function test_a_rate_limited_model_falls_back_to_the_second_groq_model(): void
    {
        Http::fake([self::GROQ => Http::sequence()
            ->push(['error' => ['message' => 'Rate limit reached']], 429)
            ->push(self::groqReply('From the fallback model'))]);

        $this->assertSame('From the fallback model', $this->ai()->ask('Hi'));

        $models = collect(Http::recorded())->map(fn ($pair) => $pair[0]['model'])->all();
        $this->assertSame(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'], $models);
    }

    public function test_gemini_answers_when_groq_is_down(): void
    {
        Http::fake([
            self::GROQ => Http::response('Service unavailable', 503),
            'generativelanguage.googleapis.com/*' => Http::response(self::geminiReply('From Gemini')),
        ]);

        $this->assertSame('From Gemini', $this->ai()->ask('Hi'));
    }

    public function test_gemini_goes_first_when_chosen_and_groq_backs_it_up(): void
    {
        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response('Quota exceeded', 429),
            self::GROQ => Http::response(self::groqReply('From Groq')),
        ]);

        $this->assertSame('From Groq', $this->ai('gemini')->ask('Hi'));
        $this->assertStringContainsString('generativelanguage', collect(Http::recorded())->first()[0]->url());
    }

    public function test_every_provider_failing_returns_nothing_and_local_makes_no_calls(): void
    {
        Http::fake(['*' => Http::response('down', 500)]);
        $this->assertNull($this->ai()->ask('Hi'));

        Http::fake();
        $this->assertNull($this->ai('local')->ask('Hi'));
        Http::assertNothingSent();
    }

    public function test_maths_written_with_backslash_brackets_comes_back_with_dollars(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply("Roots \\(x=-3\\) and \\(x=\\frac12\\).\n\\[\nx=\\frac{-5\\pm7}{4}\n\\]"))]);

        $this->assertSame("Roots \$x=-3\$ and \$x=\\frac12\$.\n\$\$x=\\frac{-5\\pm7}{4}\$\$", $this->ai()->ask('Solve'));
    }

    public function test_question_import_reads_groq_json(): void
    {
        Http::fake([self::GROQ => Http::response(self::groqReply(json_encode(['questions' => [
            ['question_text' => '1. What is $3^2 + 4^2$?', 'difficulty' => 'easy', 'explanation' => '9 + 16 = 25',
                'options' => [['option_text' => '(a) 7', 'is_correct' => false], ['option_text' => '(b) 25', 'is_correct' => true]]],
            ['question_text' => 'Which gas is produced?', 'options' => [['option_text' => 'hydrogen', 'is_correct' => true], ['option_text' => 'oxygen', 'is_correct' => false]]],
        ]])))]);

        $questions = app(AIService::class)->extractAndSolveQuestions("1. What is 3^2 + 4^2? (a) 7 (b) 25\n2. Which gas is produced? (a) hydrogen (b) oxygen");

        $this->assertCount(2, $questions);
        $this->assertSame('What is $3^2 + 4^2$?', $questions[0]['question_text']);
        $this->assertSame('25', $questions[0]['options'][1]['option_text']);
        $this->assertTrue($questions[0]['options'][1]['is_correct']);
        Http::assertSent(fn (Request $r) => $r['response_format'] === ['type' => 'json_object']
            && str_contains($r['messages'][0]['content'], '{"questions": [ ... ]}'));
    }
}
