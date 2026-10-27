<?php

namespace Tests\Unit\Support;

use App\Services\AI\QuestionTextParser;
use App\Support\MathText;
use App\Support\SearchTerm;
use PHPUnit\Framework\TestCase;

class TextHelpersTest extends TestCase
{
    public function test_math_delimiters_become_the_ones_katex_renders(): void
    {
        $this->assertSame('Roots $x=1$ and $$x^2$$', MathText::normalizeDelimiters('Roots \(x=1\) and \[x^2\]'));
    }

    public function test_an_expression_written_twice_is_kept_once(): void
    {
        $this->assertSame('Solve $2x + 5 = 15$', MathText::removeDuplicates('Solve $2x + 5 = 15$ 2x + 5 = 15'));
    }

    public function test_text_that_only_mentions_the_expression_is_kept(): void
    {
        $line = 'Let $x$ be the number of boys, so x + 2 = 7';
        $this->assertSame($line, MathText::removeDuplicates($line));
        $this->assertSame('Price is $5 and $10 today', MathText::removeDuplicates('Price is $5 and $10 today'));
    }

    public function test_search_terms_match_wildcard_characters_literally(): void
    {
        $this->assertSame('%50\%\_off%', SearchTerm::like('50%_off'));
        $this->assertSame('%%', SearchTerm::like(['not', 'text']));
    }

    public function test_question_numbers_and_option_letters_are_stripped_only_when_they_are_labels(): void
    {
        $this->assertSame('What is 2+2?', QuestionTextParser::stripQuestionNumber('1. What is 2+2?'));
        $this->assertSame('2 + 3 equals?', QuestionTextParser::stripQuestionNumber('2 + 3 equals?'));
        $this->assertSame('Lagos', QuestionTextParser::stripOptionLetter('A. Lagos'));
        $this->assertSame('A triangle', QuestionTextParser::stripOptionLetter('A triangle'));
        $this->assertSame('D.N.A', QuestionTextParser::stripOptionLetter('D.N.A'));
    }
}
