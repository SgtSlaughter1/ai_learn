<?php

namespace App\Services\AI;

/**
 * Learners' names never go to the AI provider: each learner in the staff chat becomes
 * "Learner 1", "Learner 2"…, names typed by the teacher or in earlier turns are swapped for
 * the same labels, and the reply gets the real names back before anyone sees it.
 */
class LearnerLabels
{
    /** @var array<int, string> label number => real name */
    private array $names = [];

    /** @var array<string, string> name as it may appear in text => label */
    private array $aliases = [];

    /** @var array<string, int> first name => how many learners have it */
    private array $firstNames = [];

    public function add(string $name): string
    {
        $number = count($this->names) + 1;
        $label = "Learner {$number}";
        $this->names[$number] = $name;
        $this->aliases[mb_strtolower($name)] = $label;

        $first = strtok($name, ' ');
        if ($first !== false && mb_strlen($first) >= 3) {
            $this->firstNames[$first] = ($this->firstNames[$first] ?? 0) + 1;
            $this->aliases['first:'.$first] = $label;
        }

        return $label;
    }

    /** Text on its way to the AI: full names (any case), then first names only one learner has. */
    public function hide(string $text): string
    {
        $full = array_filter($this->aliases, fn ($key) => ! str_starts_with($key, 'first:'), ARRAY_FILTER_USE_KEY);
        // Longest first, so "Ada Obi-Eze" is replaced before "Ada Obi".
        uksort($full, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
        foreach ($full as $name => $label) {
            $text = preg_replace('/(?<![\p{L}\p{N}])'.preg_quote($name, '/').'(?![\p{L}\p{N}])/iu', $label, $text) ?? $text;
        }

        // A first name only as written with a capital ("Joy", not "joy"), and only when one
        // learner has it, so ordinary words and shared names are left alone.
        foreach ($this->firstNames as $first => $count) {
            if ($count === 1) {
                $text = preg_replace('/(?<![\p{L}\p{N}])'.preg_quote($first, '/').'(?![\p{L}\p{N}])/u', $this->aliases['first:'.$first], $text) ?? $text;
            }
        }

        return $text;
    }

    /** The AI's reply on its way to the teacher: every label back to the learner's name. */
    public function reveal(string $text): string
    {
        return preg_replace_callback('/\bLearner[\s\-]?(\d+)\b/i', fn ($m) => $this->names[(int) $m[1]] ?? $m[0], $text) ?? $text;
    }
}
