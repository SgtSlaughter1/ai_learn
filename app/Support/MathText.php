<?php

namespace App\Support;

/**
 * Clean-up for maths in AI text: the delimiters KaTeX renders, and expressions models write twice.
 */
class MathText
{
    /**
     * Some models write maths as \( ... \) and \[ ... \]; the app renders $...$ and $$...$$.
     */
    public static function normalizeDelimiters(string $text): string
    {
        // \x5C is a backslash: \[ ... \] becomes $$ ... $$, \( ... \) becomes $ ... $.
        $text = preg_replace_callback('#\x5C\[(.+?)\x5C\]#s', fn ($m) => '$$'.trim($m[1]).'$$', $text);

        return preg_replace_callback('#\x5C\((.+?)\x5C\)#s', fn ($m) => '$'.trim($m[1]).'$', $text);
    }

    /** Decode a JSON reply into a list of questions (Groq wraps the list in "questions"). */

    /**
     * Clean up duplicate math rendering from Gemini responses.
     * Gemini often returns both LaTeX AND plain text for the same expression,
     * e.g. "$2x + 5 = 15$ 2x + 5 = 15" — this removes the duplicate plain text.
     */
    public static function removeDuplicates(string $text): string
    {
        // 1. Remove duplicate LaTeX: "$...$ $...$" → "$...$"
        $text = preg_replace('/(\$\$.+?\$\$)\s+\1/', '$1', $text);
        $text = preg_replace('/(\$[^$]+\$)\s+\1/', '$1', $text);

        // Simpler approach: find $content$ and remove plain text duplicate after it
        // Split by lines and process
        $lines = explode("\n", $text);
        $cleaned = [];
        foreach ($lines as $line) {
            // Pattern: inline math followed by its plain text duplicate
            // e.g. "$2x + 5 = 15$ 2x + 5 = 15" or "$2x + 5 = 15$ $2x + 5 = 15$"
            $line = preg_replace(
                '/(\$[^$]+\$)\s+\1[.,;:!?]?/',
                '$1',
                $line
            );
            // Pattern: display math followed by its plain text duplicate
            $line = preg_replace(
                '/(\$\$.+?\$\$)\s+\1[.,;:!?]?/',
                '$1',
                $line
            );
            // Pattern: plain text duplicate after inline math
            // e.g. "$x = 5$ x = 5" where x = 5 is the same content
            $line = preg_replace_callback(
                '#(\$)([^$]+)(\$)\s+([\w\s+\-*/=().,]+?)(?=\$|\z)#', // up to the next expression or the end of the line (it runs per line)
                function ($matches) {
                    $mathContent = trim($matches[2]);
                    $plainText = trim($matches[4]);
                    // Normalize both for comparison (remove spaces, LaTeX commands)
                    $normMath = str_replace([' ', "\t", "\n", "\r", '\\'], '', $mathContent);
                    $normPlain = str_replace([' ', "\t", "\n", "\r", '\\'], '', $plainText);
                    // Only an exact repeat: "Let $x$ be the boys, so x + 2" merely contains x and must stay.
                    if ($normMath !== '' && $normMath === $normPlain) {
                        return '$'.$mathContent.'$';
                    }

                    return $matches[0];
                },
                $line
            );
            $cleaned[] = $line;
        }
        $text = implode("\n", $cleaned);

        return $text;
    }
}
