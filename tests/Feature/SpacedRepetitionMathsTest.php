<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Question;
use App\Models\SpacedRepetitionItem;
use App\Models\Topic;
use App\Models\User;
use App\Services\SpacedRepetition\SpacedRepetitionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The review schedule (SM-2): intervals, ease bounds and graduation to mastered. */
class SpacedRepetitionMathsTest extends TestCase
{
    use RefreshDatabase;

    private User $learner;

    private Question $question;

    protected function setUp(): void
    {
        parent::setUp();
        $this->learner = User::factory()->create(['role' => UserRole::LEARNER]);
        $this->question = Question::factory()->create(['topic_id' => Topic::factory()->create()->id]);
    }

    private function review(bool $correct, ?string $rating = null): SpacedRepetitionItem
    {
        return app(SpacedRepetitionService::class)->recordAttempt($this->learner, [
            'question_id' => $this->question->id,
            'is_correct' => $correct,
            'rating' => $rating,
        ])->fresh();
    }

    public function test_correct_reviews_climb_the_interval_ladder(): void
    {
        $this->assertSame(3, (int) $this->review(true, 'good')->interval_days); // first sight
        $this->assertSame(7, (int) $this->review(true, 'good')->interval_days);
        $this->assertSame(14, (int) $this->review(true, 'good')->interval_days);
    }

    public function test_a_mistake_sends_the_item_back_to_tomorrow(): void
    {
        $this->review(true, 'good');
        $this->review(true, 'good');
        $item = $this->review(false);

        $this->assertSame(1, (int) $item->interval_days);
        $this->assertSame('recent_mistake', $item->reason_tag);
        $this->assertTrue($item->next_review_at->isTomorrow());
    }

    public function test_ease_never_drops_below_1_30_or_rises_above_3_00(): void
    {
        $this->review(false);
        for ($i = 0; $i < 10; $i++) {
            $item = $this->review(false);
        }
        $this->assertEqualsWithDelta(1.30, (float) $item->ease_factor, 0.001);

        for ($i = 0; $i < 12; $i++) {
            $item = $this->review(true, 'easy');
        }
        $this->assertLessThanOrEqual(3.00, (float) $item->ease_factor);
    }

    public function test_the_interval_is_capped_at_a_year(): void
    {
        // Found on MySQL: unbounded "easy" growth pushed the next review past 2038 and the save failed.
        for ($i = 0; $i < 25; $i++) {
            $item = $this->review(true, 'easy');
        }

        $this->assertLessThanOrEqual(365, (int) $item->interval_days);
        $this->assertTrue($item->next_review_at->lessThanOrEqualTo(now()->addDays(366)));
    }

    public function test_five_correct_in_a_row_graduates_to_mastered(): void
    {
        $this->review(true, 'good');
        for ($i = 0; $i < 4; $i++) {
            $item = $this->review(true, 'good');
        }

        $this->assertSame('mastered', $item->status);
        $this->assertGreaterThanOrEqual(60, (int) $item->interval_days);
    }
}
