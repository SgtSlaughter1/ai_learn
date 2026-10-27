<?php

namespace Tests\Unit\Services;

use App\Services\Adaptive\AdaptiveService;
use PHPUnit\Framework\TestCase;

class AdaptiveAbilityTest extends TestCase
{
    public function test_an_even_match_moves_ability_by_half_the_k_factor(): void
    {
        $this->assertSame(1516, AdaptiveService::nextAbility(1500, 1500, true));
        $this->assertSame(1484, AdaptiveService::nextAbility(1500, 1500, false));
    }

    public function test_a_surprise_moves_ability_more_than_an_expected_result(): void
    {
        $upsetWin = AdaptiveService::nextAbility(1000, 2000, true) - 1000;
        $expectedWin = AdaptiveService::nextAbility(2000, 1000, true) - 2000;

        $this->assertGreaterThan($expectedWin, $upsetWin);
    }

    public function test_ability_stays_within_its_bounds(): void
    {
        $this->assertSame(AdaptiveService::MAX_ABILITY, AdaptiveService::nextAbility(AdaptiveService::MAX_ABILITY, 2000, true));
        $this->assertSame(AdaptiveService::MIN_ABILITY, AdaptiveService::nextAbility(AdaptiveService::MIN_ABILITY, 1000, false));
    }
}
