<?php

namespace App\Services\AI;

use App\Support\MathText;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Talks to the AI providers (Groq, then Gemini) within one time budget per request, skipping models
 * that are rate-limited. Returns null when every provider fails, so callers use the offline answers.
 */
class AiClient
{
    protected string $provider;

    /** Gemini API key. */
    protected ?string $apiKey;

    /** Gemini model. */
    protected string $modelName;

    protected ?string $groqKey;

    /** End of the current generate() call's time budget (microtime). */
    private float $deadline = INF;

    public function __construct(?string $provider = null, ?string $apiKey = null, ?string $modelName = null)
    {
        // config() only (it already falls back across the env names); env() is null once config is cached.
        $this->apiKey = $apiKey ?? config('services.gemini.api_key');
        $this->modelName = $modelName ?? (config('services.gemini.model') ?: 'gemini-3.1-flash-lite');
        $this->groqKey = config('services.groq.api_key') ?: null;
        $this->provider = $provider ?? (config('services.ai.provider') ?: match (true) {
            ! empty($this->groqKey) => 'groq',
            ! empty($this->apiKey) => 'gemini',
            default => 'local',
        });
    }

    /**
     * Ask the AI. Tries the chosen provider first and the other configured one after it, so a
     * failure or rate limit on one does not leave learners without an answer; null when every
     * provider fails (callers then use the built-in offline answers).
     *
     * @param  array  $contents  Gemini-style turns: [['role' => 'user'|'model', 'parts' => [['text' => ...]]]]
     * @param  bool  $json  Ask for a JSON reply (question import and generation).
     */
    public function generate(array $contents, ?string $systemInstruction = null, bool $json = false): ?string
    {
        if ($this->provider === 'local') {
            return null;
        }
        // The whole chain shares one time budget, well inside PHP's execution limit on shared
        // hosting, so a slow provider still leaves time to fall back to the offline answer.
        $this->deadline = microtime(true) + (float) config('services.ai.time_budget', 20);

        $order = $this->provider === 'gemini' ? ['gemini', 'groq'] : ['groq', 'gemini'];
        foreach ($order as $provider) {
            $text = $provider === 'groq'
                ? $this->callGroq($contents, $systemInstruction, $json)
                : $this->callGemini($contents, $systemInstruction, $json ? ['response_mime_type' => 'application/json'] : []);
            if ($text !== null && $text !== '') {
                // Maths clean-up is for prose only: in JSON it would rewrite string contents.
                return $json ? $text : MathText::removeDuplicates(MathText::normalizeDelimiters($text));
            }
        }

        return null;
    }

    /**
     * Seconds the next request may take: its own limit, cut to what is left of the budget.
     * Null when too little is left to be worth trying.
     */
    private function requestTimeout(int $limit): ?int
    {
        $left = (int) floor($this->deadline - microtime(true));

        return $left < 3 ? null : min($limit, $left);
    }

    private function coolingDown(string $provider, string $model): bool
    {
        return Cache::has("ai:cooldown:{$provider}:{$model}");
    }

    /**
     * Note a failed request. A rate limit (429) puts that model aside for the Retry-After time
     * (60 s when not given), so the next requests go straight to the next model or provider.
     */
    private function recordFailure(string $provider, string $model, ?Response $response, ?\Throwable $e = null): void
    {
        if ($response?->status() === 429) {
            $retryAfter = (int) ($response->header('Retry-After') ?: 60);
            Cache::put("ai:cooldown:{$provider}:{$model}", true, max(5, min($retryAfter, 600)));
        }

        // Never the exception message: for some failures it contains the request URL.
        Log::warning('ai.provider_failed', [
            'provider' => $provider,
            'model' => $model,
            'status' => $response?->status(),
            'error' => $e ? class_basename($e) : null,
            'finish_reason' => $response?->json('choices.0.finish_reason') ?? $response?->json('candidates.0.finishReason'),
        ]);
    }

    /**
     * Groq's OpenAI-compatible chat API: the main model, then the fallback model (each has
     * its own rate limits). A rate-limited or failing model moves on to the next at once.
     */
    protected function callGroq(array $contents, ?string $systemInstruction = null, bool $json = false): ?string
    {
        if (empty($this->groqKey)) {
            return null;
        }

        $messages = [];
        $system = trim((string) $systemInstruction);
        if ($json) {
            // JSON mode needs an object at the top level: arrays come back under "questions".
            $system .= ($system ? "\n\n" : '').'Reply with one JSON object only. When the answer is a list of questions, return it as {"questions": [ ... ]}.';
        }
        if ($system !== '') {
            $messages[] = ['role' => 'system', 'content' => $system];
        }
        foreach ($contents as $turn) {
            $text = collect($turn['parts'] ?? [])->pluck('text')->filter()->implode("\n");
            if ($text !== '') {
                $messages[] = ['role' => ($turn['role'] ?? 'user') === 'model' ? 'assistant' : 'user', 'content' => $text];
            }
        }

        $models = array_values(array_unique(array_filter([
            config('services.groq.model', 'openai/gpt-oss-120b'),
            config('services.groq.fallback_model'),
        ])));
        $url = rtrim((string) config('services.groq.base_url', 'https://api.groq.com/openai/v1'), '/').'/chat/completions';

        foreach ($models as $model) {
            if ($this->coolingDown('groq', $model)) {
                continue;
            }
            $timeout = $this->requestTimeout($json ? 25 : 15);
            if ($timeout === null) {
                return null;
            }

            $body = [
                'model' => $model,
                'messages' => $messages,
                'temperature' => $json ? 0.2 : 0.4,
                'max_completion_tokens' => $json ? 6000 : 1500,
            ];
            if (str_starts_with($model, 'openai/gpt-oss')) {
                // Reasoning models: think briefly, return only the answer.
                $body['reasoning_effort'] = $json ? 'medium' : 'low';
                $body['reasoning_format'] = 'hidden';
            }
            if ($json) {
                $body['response_format'] = ['type' => 'json_object'];
            }

            try {
                $response = Http::withToken($this->groqKey)->connectTimeout(5)->timeout($timeout)->post($url, $body);
                $text = $response->successful() ? trim((string) $response->json('choices.0.message.content')) : '';
                if ($text !== '') {
                    return $text;
                }
                $this->recordFailure('groq', $model, $response);
            } catch (\Exception $e) {
                $this->recordFailure('groq', $model, null, $e);
            }
        }

        return null;
    }

    /**
     * Call Gemini API with automatic model fallback for high availability.
     */
    protected function callGemini(array $contents, ?string $systemInstruction = null, array $generationConfig = []): ?string
    {
        if (empty($this->apiKey)) {
            return null;
        }

        // Two models at most: each try costs time from the shared budget.
        $modelsToTry = array_values(array_unique(array_filter([
            $this->modelName,
            config('services.gemini.fallback_model', 'gemini-flash-lite-latest'),
        ])));

        $payload = ['contents' => $contents];
        if (! empty($systemInstruction)) {
            $payload['systemInstruction'] = [
                'parts' => [['text' => $systemInstruction]],
            ];
        }
        if (! empty($generationConfig)) {
            $payload['generationConfig'] = $generationConfig;
        }

        foreach ($modelsToTry as $model) {
            if ($this->coolingDown('gemini', $model)) {
                continue;
            }
            $timeout = $this->requestTimeout(20);
            if ($timeout === null) {
                return null;
            }

            try {
                // Key in a header, not the URL: URLs end up in error messages and logs.
                $response = Http::connectTimeout(5)->timeout($timeout)
                    ->withHeaders(['x-goog-api-key' => $this->apiKey])
                    ->post("https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent", $payload);

                $text = $response->successful() ? trim((string) $response->json('candidates.0.content.parts.0.text')) : '';
                if ($text !== '') {
                    return $text;
                }
                $this->recordFailure('gemini', $model, $response);
            } catch (\Exception $e) {
                $this->recordFailure('gemini', $model, null, $e);
            }
        }

        return null;
    }
}
