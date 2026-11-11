<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * The order a learner sees a question's options in. Questions are often written with the right
 * answer first (every seeded one is), so options are shuffled for each learner and question.
 * The order is fixed per learner, so a reload, the offline copy and a later review all match.
 *
 * Kept as written: true/false and yes/no pairs, and sets whose options refer to each other
 * ("A and B only", "Option C"). "All/None of the above" style options always go last.
 */
final class OptionOrder
{
    private const GOES_LAST = '/^\s*(all|none|both|neither)\b.*\b(above|these|of them|options)\b/i';

    private const REFERS_TO_LETTERS = '/\b(options?\s+[A-E]|[A-E]\s*(,|&|and|or)\s*[A-E])\b/';

    private const FIXED_SETS = [['true', 'false'], ['false', 'true'], ['yes', 'no'], ['no', 'yes']];

    /**
     * @param  iterable<array|object>  $options  rows with an id and option text
     * @return Collection<int, array|object>
     */
    public static function forLearner(iterable $options, int|string|null $learnerId, int|string $questionId, string $textKey = 'option_text'): Collection
    {
        $options = collect($options)->values();
        $texts = $options->map(fn ($o) => trim((string) data_get($o, $textKey)));

        if ($options->count() < 2
            || in_array($texts->map(fn ($t) => strtolower(rtrim($t, '.')))->all(), self::FIXED_SETS, true)
            || $texts->contains(fn ($t) => preg_match(self::REFERS_TO_LETTERS, $t))) {
            return $options;
        }

        [$last, $rest] = $options->partition(fn ($o) => preg_match(self::GOES_LAST, (string) data_get($o, $textKey)) === 1);
        $seed = "{$learnerId}|{$questionId}|";

        return $rest->sortBy(fn ($o) => md5($seed.data_get($o, 'id')))->values()->concat($last->values());
    }
}
