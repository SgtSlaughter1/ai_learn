<?php

namespace App\Support;

/**
 * A "contains" pattern for LIKE that matches the typed text literally: % and _ typed in a search
 * box would otherwise be wildcards ("50%" matched everything starting with 50).
 * Backslash is MySQL's default LIKE escape character.
 */
class SearchTerm
{
    public static function like(mixed $term): string
    {
        // ?search[]=x arrives as an array: treat anything but text as an empty search.
        $term = is_scalar($term) ? (string) $term : '';

        return '%'.addcslashes($term, '\\%_').'%';
    }
}
