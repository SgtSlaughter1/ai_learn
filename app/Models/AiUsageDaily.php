<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** AI requests and tokens per day, feature and model: one row per combination, counted up in place. */
class AiUsageDaily extends Model
{
    protected $table = 'ai_usage_daily';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'day' => 'date',
            'requests' => 'integer',
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
        ];
    }

    /**
     * Count one billed request. A single upsert, so concurrent requests never lose a count.
     * Metering must never cost a learner their answer, so a failure here is only logged.
     */
    public static function record(string $feature, string $provider, string $model, int $promptTokens, int $completionTokens): void
    {
        $promptTokens = max(0, $promptTokens);
        $completionTokens = max(0, $completionTokens);

        try {
            DB::table('ai_usage_daily')->upsert(
                [[
                    'day' => now()->toDateString(),
                    'feature' => mb_substr($feature, 0, 30),
                    'provider' => $provider,
                    'model' => mb_substr($model, 0, 80),
                    'requests' => 1,
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                ]],
                ['day', 'feature', 'provider', 'model'],
                [
                    'requests' => DB::raw('requests + 1'),
                    'prompt_tokens' => DB::raw("prompt_tokens + {$promptTokens}"),
                    'completion_tokens' => DB::raw("completion_tokens + {$completionTokens}"),
                ],
            );
        } catch (\Throwable $e) {
            Log::warning('ai.usage_not_recorded', ['feature' => $feature, 'error' => class_basename($e)]);
        }
    }
}
