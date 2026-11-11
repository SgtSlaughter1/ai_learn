<?php

namespace Tests\Unit;

use App\Support\OptionOrder;
use PHPUnit\Framework\TestCase;

class OptionOrderTest extends TestCase
{
    private static function options(array $texts): array
    {
        return array_map(fn ($t, $i) => ['id' => $i + 1, 'option_text' => $t], $texts, array_keys($texts));
    }

    public function test_the_right_answer_is_not_always_first(): void
    {
        $positions = [];
        foreach (range(1, 200) as $questionId) {
            $order = OptionOrder::forLearner(self::options(['right', 'w1', 'w2', 'w3']), 'learner-1', $questionId)->pluck('id')->all();
            $positions[array_search(1, $order, true)] = ($positions[array_search(1, $order, true)] ?? 0) + 1;
        }
        ksort($positions);
        $this->assertCount(4, $positions);
        foreach ($positions as $count) {
            $this->assertGreaterThan(25, $count, 'Each position gets a fair share.');
        }
    }

    public function test_the_order_is_the_same_each_time_for_a_learner_and_differs_between_learners(): void
    {
        $opts = self::options(['a', 'b', 'c', 'd', 'e']);
        $first = OptionOrder::forLearner($opts, 'learner-1', 7)->pluck('id')->all();
        $this->assertSame($first, OptionOrder::forLearner($opts, 'learner-1', 7)->pluck('id')->all());

        $others = collect(range(2, 30))->map(fn ($l) => OptionOrder::forLearner($opts, "learner-{$l}", 7)->pluck('id')->all());
        $this->assertTrue($others->contains(fn ($o) => $o !== $first));
    }

    public function test_some_sets_keep_their_order_and_above_style_options_go_last(): void
    {
        $this->assertSame([1, 2], OptionOrder::forLearner(self::options(['True', 'False']), 'x', 1)->pluck('id')->all());
        $this->assertSame([1, 2, 3, 4], OptionOrder::forLearner(self::options(['2', '3', 'A and B only', '5']), 'x', 1)->pluck('id')->all());

        foreach (range(1, 20) as $q) {
            $order = OptionOrder::forLearner(self::options(['None of the above', 'x', 'y', 'z']), 'x', $q)->pluck('id')->all();
            $this->assertSame(1, end($order));
        }
    }
}
