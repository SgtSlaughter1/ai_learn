<?php

namespace Tests\Unit\Services\Gamification;

use App\Models\UserGamification;
use App\Services\Gamification\Levels;
use App\Services\Gamification\StreakStatus;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LevelsAndStreaksTest extends TestCase
{
    /** @return iterable<string, array{int, int}> total XP => level */
    public static function levelBoundaries(): iterable
    {
        yield 'no XP' => [0, 1];
        yield 'one short of level 2' => [99, 1];
        yield 'exactly level 2' => [100, 2];
        yield 'exactly level 5' => [800, 5];
        yield 'top level' => [12500, 15];
        yield 'beyond the top' => [99999, 15];
    }

    #[DataProvider('levelBoundaries')]
    public function test_level_follows_the_xp_thresholds(int $xp, int $level): void
    {
        // Unsaved model: recalculate() sets the fields without touching the database.
        $profile = new UserGamification(['total_xp' => $xp, 'level' => 1, 'tier' => 'Newcomer']);

        Levels::recalculate($profile);

        $this->assertSame($level, $profile->level);
        $this->assertSame(Levels::tierForLevel($level), $profile->tier);
    }

    public function test_every_level_has_a_tier_and_a_colour(): void
    {
        foreach (array_keys(Levels::THRESHOLDS) as $level) {
            $this->assertNotSame('', Levels::tierForLevel($level));
            $this->assertMatchesRegularExpression('/^#[0-9a-f]{6}$/i', Levels::tierColor($level));
        }
    }

    /** @return iterable<string, array{int, int}> streak => next milestone */
    public static function milestones(): iterable
    {
        yield 'start' => [0, 3];
        yield 'day 3' => [3, 7];
        yield 'day 13' => [13, 14];
        yield 'day 29' => [29, 30];
        yield 'day 30 rounds up to 40' => [30, 40];
        yield 'day 41 rounds up to 50' => [41, 50];
    }

    #[DataProvider('milestones')]
    public function test_next_streak_milestone(int $streak, int $target): void
    {
        $milestone = StreakStatus::nextMilestone($streak);

        $this->assertSame($target, $milestone['target_days']);
        $this->assertSame($target - $streak, $milestone['days_remaining']);
        $this->assertLessThanOrEqual(100, $milestone['percent']);
    }
}
