<?php

namespace App\Console\Commands;

use App\Models\AiExplanation;
use App\Models\AiUsageDaily;
use Illuminate\Console\Command;

class AiUsageCommand extends Command
{
    protected $signature = 'ai:usage {--days=30 : How many days back to count, today included}';

    protected $description = 'Show AI requests and tokens per feature and model, and how many explanations are saved for reuse.';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $since = now()->subDays($days - 1)->toDateString();

        $rows = AiUsageDaily::where('day', '>=', $since)
            ->selectRaw('feature, provider, model, SUM(requests) as requests, SUM(prompt_tokens) as prompt_tokens, SUM(completion_tokens) as completion_tokens')
            ->groupBy('feature', 'provider', 'model')
            ->orderByDesc('completion_tokens')
            ->get();

        $this->info("AI usage for the last {$days} ".($days === 1 ? 'day' : 'days')." (since {$since})");
        if ($rows->isEmpty()) {
            $this->line('No AI requests recorded yet.');
        } else {
            $number = fn ($n) => number_format((int) $n);
            $this->table(
                ['Feature', 'Provider', 'Model', 'Requests', 'Input tokens', 'Output tokens', 'Tokens per request'],
                $rows->map(fn ($r) => [
                    $r->feature, $r->provider, $r->model, $number($r->requests), $number($r->prompt_tokens), $number($r->completion_tokens),
                    $number($r->requests > 0 ? ($r->prompt_tokens + $r->completion_tokens) / $r->requests : 0),
                ])->push(['Total', '', '', $number($rows->sum('requests')), $number($rows->sum('prompt_tokens')), $number($rows->sum('completion_tokens')), ''])->all(),
            );
        }

        $saved = AiExplanation::selectRaw('source, COUNT(*) as total')->groupBy('source')->pluck('total', 'source');
        $this->newLine();
        $this->line('Explanations saved for reuse: '
            .number_format((int) ($saved[AiExplanation::SOURCE_QUESTION] ?? 0)).' school questions, '
            .number_format((int) ($saved[AiExplanation::SOURCE_PAST_QUESTION] ?? 0)).' past questions.');

        return self::SUCCESS;
    }
}
