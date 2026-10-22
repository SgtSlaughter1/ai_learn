<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * Which questions make up one attempt. Questions about the same passage (context_id)
 * are one unit: an attempt takes all of them or none, in their context_order, so a
 * learner never gets question 3 about a passage without questions 1 and 2.
 *
 * Mirrors resources/js/services/AttemptQuestions.ts, which picks the same way offline.
 */
class AttemptQuestions
{
    /**
     * Group questions into units, keeping the given order of first appearance.
     *
     * @return Collection<int, Collection>
     */
    public static function units(Collection $questions): Collection
    {
        $units = [];
        foreach ($questions as $question) {
            $key = $question->context_id ? 'c'.$question->context_id : 'q'.$question->id;
            $units[$key][] = $question;
        }

        return collect($units)->values()->map(fn (array $unit) => collect($unit)
            ->sortBy(fn ($q) => [$q->context_order ?? PHP_INT_MAX, $q->id])->values());
    }

    /**
     * Take whole units until there are at least $limit questions (the last unit may
     * take it a little over, never under), then flatten.
     */
    public static function pick(Collection $questions, int $limit, bool $shuffle = true): Collection
    {
        $units = self::units($questions);
        if ($shuffle) {
            $units = $units->shuffle();
        }

        $picked = collect();
        foreach ($units as $unit) {
            if ($picked->count() >= $limit) {
                break;
            }
            $picked = $picked->concat($unit);
        }

        return $picked->values();
    }
}
