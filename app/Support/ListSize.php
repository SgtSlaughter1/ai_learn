<?php

namespace App\Support;

/**
 * How many rows a list request may ask for. Request values are untrusted: "-1" makes
 * Builder::limit() drop the limit entirely, "abc" makes paginate() fail, and a huge
 * number loads the whole table. Anything outside 1..max falls back to a safe value.
 */
class ListSize
{
    public static function from(mixed $requested, int $default, int $max): int
    {
        if (! is_numeric($requested)) {
            return $default;
        }

        return max(1, min($max, (int) $requested));
    }
}
