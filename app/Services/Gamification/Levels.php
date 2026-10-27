<?php

namespace App\Services\Gamification;

use App\Models\Achievement;
use App\Models\UserGamification;

/**
 * XP level thresholds and tier names: the maths behind a learner's level and tier.
 */
class Levels
{
    /**
     * XP thresholds required to reach each level.
     * Level 1 starts at 0 XP.
     */
    public const THRESHOLDS = [
        1 => 0,
        2 => 100,
        3 => 250,
        4 => 500,
        5 => 800,
        6 => 1200,
        7 => 1700,
        8 => 2300,
        9 => 3000,
        10 => 4000,
        11 => 5200,
        12 => 6600,
        13 => 8200,
        14 => 10000,
        15 => 12500,
    ];

    /**
     * Tier definitions mapped to level ranges and visual color tokens.
     */
    public const TIERS = [
        ['min_level' => 1,  'max_level' => 2,  'tier' => 'Newcomer',  'color' => '#94a3b8'],
        ['min_level' => 3,  'max_level' => 4,  'tier' => 'Learner',   'color' => '#60a5fa'],
        ['min_level' => 5,  'max_level' => 6,  'tier' => 'Scholar',   'color' => '#34d399'],
        ['min_level' => 7,  'max_level' => 8,  'tier' => 'Achiever',  'color' => '#a78bfa'],
        ['min_level' => 9,  'max_level' => 10, 'tier' => 'Expert',    'color' => '#fbbf24'],
        ['min_level' => 11, 'max_level' => 12, 'tier' => 'Master',    'color' => '#f97316'],
        ['min_level' => 13, 'max_level' => 14, 'tier' => 'Champion',  'color' => '#ef4444'],
        ['min_level' => 15, 'max_level' => 99, 'tier' => 'Legend',    'color' => '#ec4899'],
    ];

    /**
     * Recalculate level and tier based on accumulated total XP.
     */
    public static function recalculate(UserGamification $profile): void
    {
        $newLevel = 1;
        foreach (self::THRESHOLDS as $level => $threshold) {
            if ($profile->total_xp >= $threshold) {
                $newLevel = $level;
            } else {
                break;
            }
        }

        $newTier = self::tierForLevel($newLevel);

        if ($newLevel !== $profile->level || $newTier !== $profile->tier) {
            $profile->update([
                'level' => $newLevel,
                'tier' => $newTier,
            ]);
            $profile->level = $newLevel;
            $profile->tier = $newTier;
        }
    }

    /**
     * Resolve tier title based on player level.
     */
    public static function tierForLevel(int $level): string
    {
        foreach (self::TIERS as $range) {
            if ($level >= $range['min_level'] && $level <= $range['max_level']) {
                return $range['tier'];
            }
        }

        return 'Newcomer';
    }

    /**
     * Resolve tier color token based on player level.
     */
    public static function tierColor(int $level): string
    {
        foreach (self::TIERS as $range) {
            if ($level >= $range['min_level'] && $level <= $range['max_level']) {
                return $range['color'];
            }
        }

        return '#94a3b8';
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Achievement System
}
